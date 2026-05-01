const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const { collection, getDocs, getDoc, doc, query, where, addDoc, orderBy } = require('firebase/firestore');

// Middleware to check if user is logged in and has role 'user'
const requireUser = (req, res, next) => {
    if (!req.session.userId || req.session.role !== 'user') {
        return res.redirect('/login?role=user');
    }
    next();
};

router.use(requireUser);

// User Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const requestsRef = collection(db, 'emergencyRequests');
        
        // Active Requests
        const activeQ = query(
            requestsRef, 
            where('createdBy', '==', req.session.userId),
            where('status', 'in', ['pending', 'accepted'])
        );
        const activeSnap = await getDocs(activeQ);
        let activeRequests = activeSnap.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
        activeRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // History Requests
        const historyQ = query(
            requestsRef, 
            where('createdBy', '==', req.session.userId),
            where('status', 'in', ['completed', 'reached', 'rejected'])
        );
        const historySnap = await getDocs(historyQ);
        let historyRequests = historySnap.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
        historyRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.render('user/dashboard', { activeRequests, historyRequests });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Report Accident Page
router.get('/report', (req, res) => {
    res.render('user/report');
});

// Submit Emergency POST
router.post('/report', async (req, res) => {
    try {
        const { patientName, phone, injuredCount, lat, lng } = req.body;
        
        const newRequest = {
            patientName,
            phone,
            injuredCount: parseInt(injuredCount),
            location: {
                lat: parseFloat(lat),
                lng: parseFloat(lng)
            },
            status: 'pending',
            createdBy: req.session.userId,
            createdAt: new Date().toISOString()
        };

        await addDoc(collection(db, 'emergencyRequests'), newRequest);
        res.redirect('/user/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Request Details Page
router.get('/request/:id', async (req, res) => {
    try {
        const docRef = doc(db, 'emergencyRequests', req.params.id);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists() || docSnap.data().createdBy !== req.session.userId) {
            return res.status(404).send('Request not found');
        }
        
        const emergencyRequest = { _id: docSnap.id, ...docSnap.data() };
        res.render('user/requestDetails', { emergencyRequest });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
