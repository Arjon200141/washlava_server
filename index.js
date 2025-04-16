const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const uri = process.env.MONGODB_URI || "mongodb+srv://washlava:WUAGQmdjmcvdXNCU@cluster0.ej6qyrh.mongodb.net/?appName=Cluster0";
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Database collections
let db;
let serviceCollection, userCollection, cartCollection;

async function run() {
  try {
    await client.connect();
    db = client.db('washlava');

    // Initialize collections
    serviceCollection = db.collection('services');
    userCollection = db.collection('users');
    cartCollection = db.collection('carts');
    reviewsCollection = db.collection('reviews');

    console.log("Successfully connected to MongoDB!");

    // Start the server only after DB connection is established
    app.listen(port, () => {
      console.log(`Washlava is running on port ${port}`);
    });
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
}

// Authentication middleware
const verifyToken = (req, res, next) => {
  const authorizationHeader = req.headers.authorization;
  if (!authorizationHeader) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }

  const token = authorizationHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Unauthorized access' });
    }
    req.decoded = decoded;
    next();
  });
};

const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await userCollection.findOne(query);

  if (user?.role !== 'admin') {
    return res.status(403).send({ message: 'Forbidden access' });
  }
  next();
};

// Routes
app.get('/', (req, res) => {
  res.send('Washlava is running');
});

// JWT Token
app.post('/jwt', async (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
  res.send({ token });
});

// Get all users (only for admin)
app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
  const result = await userCollection.find().toArray();
  res.send(result);
});

// Check if the user is an admin
app.get('/users/admin/:email', verifyToken, async (req, res) => {
  const email = req.params.email;
  if (email !== req.decoded.email) {
    return res.status(403).send({ message: 'Forbidden access' });
  }
  const user = await userCollection.findOne({ email });
  res.send({ admin: user?.role === 'admin' });
});

// Register a new user
app.post('/users', async (req, res) => {
  try {
    const user = req.body;
    const existingUser = await userCollection.findOne({ email: user.email });

    if (existingUser) {
      return res.send({ message: 'User already exists', insertedId: null });
    }

    const result = await userCollection.insertOne(user);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

// PATCH - Update role or ban status
app.patch('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { role, banned } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: 'Invalid ID format' });
    }

    const filter = { _id: new ObjectId(id) };
    const updateDoc = { $set: {} };

    if (role !== undefined) updateDoc.$set.role = role;
    if (banned !== undefined) updateDoc.$set.banned = banned;

    const result = await userCollection.updateOne(filter, updateDoc);
    res.send(result);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

// Delete a user
app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: 'Invalid ID format' });
    }

    const query = { _id: new ObjectId(id) };
    const result = await userCollection.deleteOne(query);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Internal Server Error' });
  }
});


// Service Routes
app.get('/services', async (req, res) => {
  try {
    const result = await serviceCollection.find().toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

app.patch('/services/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const item = req.body;
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: 'Invalid ID format' });
    }

    const filter = { _id: new ObjectId(id) };
    const updatedDoc = { $set: item };
    const result = await serviceCollection.updateOne(filter, updatedDoc);
    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to update service." });
  }
});

app.delete('/services/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: 'Invalid ID format' });
    }

    const filter = { _id: new ObjectId(id) };
    const result = await serviceCollection.deleteOne(filter);
    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to delete service." });
  }
});

// Cart Routes
app.get('/carts', verifyToken, async (req, res) => {
  try {
    const email = req.query.email;
    const query = { email: email };
    const result = await cartCollection.find(query).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

app.get('/carts', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await cartCollection.find().toArray();
    res.send(result);
  } catch (error) {
    console.error('Error fetching carts:', error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

// Add this endpoint for status updates
app.patch('/carts/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'processing', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).send({ message: 'Invalid status' });
    }

    const result = await cartCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).send({ message: 'Order not found' });
    }

    res.send({ success: true, message: 'Status updated successfully' });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

app.post('/carts', async (req, res) => {
  try {
    const cartItem = req.body;
    const result = await cartCollection.insertOne(cartItem);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

app.delete('/carts/:id', async (req, res) => {
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: 'Invalid ID format' });
    }

    const query = { _id: new ObjectId(id) };
    const result = await cartCollection.deleteOne(query);

    if (result.deletedCount === 0) {
      return res.status(404).send({ message: 'Item not found' });
    }

    res.send(result);
  } catch (error) {
    console.error('Error deleting cart item:', error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});



//Reviews Section
app.post('/reviews', async (req, res) => {
  const item = req.body;
  const result = await reviewsCollection.insertOne(item);
  res.send(result);
});

app.get('/reviews', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await reviewsCollection.find().toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

app.get('/reviews/:reviewerName', async (req, res) => {
  const { reviewerName } = req.params;
  try {
    const userReviews = await reviewsCollection.find({ reviewerName }).toArray();
    res.json(userReviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Handle process termination
process.on('SIGINT', async () => {
  try {
    await client.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  } catch (err) {
    console.error('Error closing MongoDB connection:', err);
    process.exit(1);
  }
});

// Initialize the application
run().catch(console.error);