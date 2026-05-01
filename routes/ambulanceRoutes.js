const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const { collection, getDocs, getDoc, doc, updateDoc, query, where } = require('firebase/firestore');

// Middleware to check if user is logged in and has role 'ambulance'
const requireAmbulance = (req, res, next) => {
    if (!req.session.userId || req.session.role !== 'ambulance') {
        return res.redirect('/login?role=ambulance');
    }
    next();
};

router.use(requireAmbulance);

// Ambulance Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const userDocRef = doc(db, 'users', req.session.userId);
        const userDoc = await getDoc(userDocRef);
        const ambulance = userDoc.data();
        const rejectedRequests = ambulance.rejectedRequests || [];

        const requestsRef = collection(db, 'emergencyRequests');
        
        // Incoming nearby requests (all pending excluding rejected by this ambulance)
        const pendingQ = query(requestsRef, where('status', '==', 'pending'));
        const pendingSnap = await getDocs(pendingQ);
        let incomingRequests = pendingSnap.docs
            .map(d => ({ _id: d.id, ...d.data() }))
            .filter(req => !rejectedRequests.includes(req._id));
            
        incomingRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // History (accepted or completed by this ambulance)
        const historyQ = query(requestsRef, where('acceptedBy', '==', req.session.userId));
        const historySnap = await getDocs(historyQ);
        let historyRequests = historySnap.docs.map(d => ({ _id: d.id, ...d.data() }));
        historyRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.render('ambulance/dashboard', { incomingRequests, historyRequests });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Accept Request POST
router.post('/accept/:id', async (req, res) => {
    try {
        const reqRef = doc(db, 'emergencyRequests', req.params.id);
        const reqSnap = await getDoc(reqRef);
        
        if (reqSnap.exists() && reqSnap.data().status === 'pending') {
            await updateDoc(reqRef, {
                status: 'accepted',
                acceptedBy: req.session.userId
            });
        }
        res.redirect(`/ambulance/tracking/${req.params.id}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Reject Request POST
router.post('/reject/:id', async (req, res) => {
    try {
        const userDocRef = doc(db, 'users', req.session.userId);
        const userDoc = await getDoc(userDocRef);
        let rejectedRequests = userDoc.data().rejectedRequests || [];
        
        if (!rejectedRequests.includes(req.params.id)) {
            rejectedRequests.push(req.params.id);
            await updateDoc(userDocRef, { rejectedRequests });
        }
        res.redirect('/ambulance/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Tracking Page
router.get('/tracking/:id', async (req, res) => {
    try {
        const reqRef = doc(db, 'emergencyRequests', req.params.id);
        const reqSnap = await getDoc(reqRef);
        
        if (!reqSnap.exists() || reqSnap.data().acceptedBy !== req.session.userId || !['accepted', 'reached', 'completed'].includes(reqSnap.data().status)) {
            return res.redirect('/ambulance/dashboard');
        }
        
        const emergencyRequest = { _id: reqSnap.id, ...reqSnap.data() };

        // Static dataset for 5 nearest hospitals
        const nearestHospitals = [
            { name: "City General Hospital", lat: emergencyRequest.location.lat + 0.01, lng: emergencyRequest.location.lng + 0.01 },
            { name: "Metro Care Center", lat: emergencyRequest.location.lat - 0.015, lng: emergencyRequest.location.lng + 0.005 },
            { name: "Sunrise Medical", lat: emergencyRequest.location.lat + 0.008, lng: emergencyRequest.location.lng - 0.012 },
            { name: "Apex Trauma Center", lat: emergencyRequest.location.lat - 0.005, lng: emergencyRequest.location.lng - 0.015 },
            { name: "St. Mary's Clinic", lat: emergencyRequest.location.lat + 0.012, lng: emergencyRequest.location.lng - 0.004 }
        ];

        res.render('ambulance/tracking', { emergencyRequest, nearestHospitals });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Reached Patient POST
router.post('/reached/:id', async (req, res) => {
    try {
        const reqRef = doc(db, 'emergencyRequests', req.params.id);
        const reqSnap = await getDoc(reqRef);
        
        if (!reqSnap.exists() || reqSnap.data().acceptedBy !== req.session.userId || reqSnap.data().status !== 'accepted') {
            return res.status(404).json({ success: false, message: 'Request not found or already reached' });
        }
        
        await updateDoc(reqRef, { status: 'reached' });
        res.json({ success: true, status: 'reached' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Complete Emergency POST
router.post('/complete/:id', async (req, res) => {
    try {
        const { hospitalName } = req.body;
        const reqRef = doc(db, 'emergencyRequests', req.params.id);
        const reqSnap = await getDoc(reqRef);
        
        if (reqSnap.exists() && reqSnap.data().acceptedBy === req.session.userId) {
            await updateDoc(reqRef, {
                status: 'completed',
                hospitalAdmitted: hospitalName
            });
        }
        
        res.redirect('/ambulance/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
