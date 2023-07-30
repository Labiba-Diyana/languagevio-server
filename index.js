const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY)
const app = express();
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'an unauthorized access' });
    }

    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
            return res.status(401).send({ error: true, message: 'an unauthorized access' });
        }
        req.decoded = decoded;
        next();
    })
}



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6yteddn.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const usersCollection = client.db("languagevioDB").collection("users");
        const classesCollection = client.db("languagevioDB").collection("classes");
        const instructorsCollection = client.db("languagevioDB").collection("instructors");
        const studentClassesCollection = client.db("languagevioDB").collection("studentClasses");
        const newClassesCollection = client.db("languagevioDB").collection("newClasses");
        const paymentsCollection = client.db("languagevioDB").collection("payments");
        const enrolledClassCollection = client.db("languagevioDB").collection("enrolledClasses");


        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5h' });

            res.send({ token });
        })

        // verifyAdmin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden access' });
            }
            next();
        }

        // verifyInstructor
        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden access' });
            }
            next();
        }

        // all users
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: "user already exists" })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        // admin users
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                return res.send({ admin: false });
            }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' };
            res.send(result);
        })

        app.patch('/users/admin/:id', async (req, res) => {
            const instructor = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };

            const query = { email: instructor.email }
            const existingInstructor = await instructorsCollection.findOne(query);
            if (existingInstructor) {
                const oldInstructor = await instructorsCollection.deleteOne(instructor);
                const result = await usersCollection.updateOne(filter, updateDoc);
                return res.send({ oldInstructor, result });
            }
            else {
                const result = await usersCollection.updateOne(filter, updateDoc);
                return res.send(result);
            }
        });

        // instructor users
        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                return res.send({ instructor: false });
            }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' };
            res.send(result);
        })

        app.patch('/users/instructor/:id', async (req, res) => {
            const instructor = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'instructor'
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);

            const newInstructor = await instructorsCollection.insertOne(instructor);

            res.send({ result, newInstructor });
        });


        // classes
        app.get('/classes', async (req, res) => {
            const result = await classesCollection.find().toArray();
            res.send(result);
        });


        // instructors
        app.get('/instructors', async (req, res) => {
            const result = await instructorsCollection.find().toArray();
            res.send(result);
        });

        // studentClasses
        app.get('/studentClasses', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                return res.send([]);
            }
            const decodedEmail = req.decoded.email;
            if (decodedEmail !== email) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }

            const query = { userEmail: email };
            const result = await studentClassesCollection.find(query).toArray();
            res.send(result);
        });

        app.get('/studentClasses/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await studentClassesCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/studentClasses', async (req, res) => {
            const selectedClass = req.body;
            const result = await studentClassesCollection.insertOne(selectedClass);
            res.send(result);
        });

        app.delete('/studentClasses/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await studentClassesCollection.deleteOne(query);
            res.send(result);

        });

        // new classes   
        // for admin
        app.get('/newClasses', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await newClassesCollection.find().toArray();
            res.send(result);
        });

        app.patch('/newClasses/approved/:id', async (req, res) => {
            const approvedClass = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: 'approved'
                },
            };

            const result = await newClassesCollection.updateOne(filter, updateDoc);

            const newClass = await classesCollection.insertOne(approvedClass);
            res.send({ result, newClass });
        });

        app.patch('/newClasses/denied/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: 'denied'
                },
            };

            const result = await newClassesCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        app.patch('/newClasses/feedback/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const getFeedback = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    feedback: getFeedback.feedback
                },
            };

            const result = await newClassesCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        // for instructor
        app.get('/newClasses/instructor', verifyJWT, verifyInstructor, async (req, res) => {
            const email = req.query.email;
            if (!email) {
               return res.send([]);
            }
            const decodedEmail = req.decoded.email;
            if (decodedEmail !== email) {
                return res.status(403).send({ error: true, message: 'forbidden access' });
            }

            const query = { userEmail: email };
            const result = await newClassesCollection.find(query).toArray();
            res.send(result);
        });

        app.post('/newClasses/instructor', verifyJWT, verifyInstructor, async (req, res) => {
            const newClass = req.body;
            const result = await newClassesCollection.insertOne(newClass);
            res.send(result);
        });

        // create payment intent
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        // payments
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);

            const { name, image, instructorName, email, userEmail } = payment;
            const allEnrolled = { name, image, instructorName, email, userEmail };
            const saveEnrolledClass = await enrolledClassCollection.insertOne(allEnrolled);

            const query = { _id: new ObjectId(payment.selectedId) };
            const deleteClass = await studentClassesCollection.deleteOne(query);

            const filterClass = { _id: new ObjectId(payment.classId) };
            const filterNewClass = { _id: new ObjectId(payment.approvedId) };
            const updateDoc = {
                $set: {
                    seats: payment.seats,
                    students: payment.students
                },
            };

            const updatedClass = await classesCollection.updateOne(filterClass, updateDoc);
            const updatedNewClass = await newClassesCollection.updateOne(filterNewClass, updateDoc);

            res.send({ result, deleteClass, updatedClass, updatedNewClass, saveEnrolledClass });
        });

        app.get('/payments', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                return res.send([]);
            }
            const decodedEmail = req.decoded.email;
            if (decodedEmail !== email) {
                return res.status(403).send({ error: true, message: 'forbidden access' });
            }

            const query = { userEmail: email };

            const options = {
                sort: { date: -1 },
            }

            const result = await paymentsCollection.find(query, options).toArray();
            res.send(result);
        })

        // enrolled classes
        app.get('/enrolledClasses', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                return res.send([]);
            }
            const decodedEmail = req.decoded.email;
            if (decodedEmail !== email) {
                return res.status(403).send({ error: true, message: 'forbidden access' });
            }

            const query = { userEmail: email };
            const result = await enrolledClassCollection.find(query).toArray();
            res.send(result);
        });




        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('My Languagevio is running')
});


app.listen(port, () => {
    console.log(`My server is running on port: ${port}`);
})