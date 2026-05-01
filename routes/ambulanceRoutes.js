const express = require('express');
const router = express.Router();
const EmergencyRequest = require('../models/EmergencyRequest');
const User = require('../models/User');

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
        const ambulance = await User.findById(req.session.userId);
        const rejectedRequests = ambulance.rejectedRequests || [];

        // Incoming nearby requests (all pending excluding rejected by this ambulance)
        const incomingRequests = await EmergencyRequest.find({
            status: 'pending',
            _id: { $nin: rejectedRequests }
        }).sort({ createdAt: -1 });

        // History (accepted or completed by this ambulance)
        const historyRequests = await EmergencyRequest.find({
            acceptedBy: req.session.userId
        }).sort({ createdAt: -1 });

        res.render('ambulance/dashboard', { incomingRequests, historyRequests });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Accept Request POST
router.post('/accept/:id', async (req, res) => {
    try {
        const emergencyRequest = await EmergencyRequest.findById(req.params.id);
        if (emergencyRequest && emergencyRequest.status === 'pending') {
            emergencyRequest.status = 'accepted';
            emergencyRequest.acceptedBy = req.session.userId;
            await emergencyRequest.save();
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
        const ambulance = await User.findById(req.session.userId);
        if (!ambulance.rejectedRequests.includes(req.params.id)) {
            ambulance.rejectedRequests.push(req.params.id);
            await ambulance.save();
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
        const emergencyRequest = await EmergencyRequest.findOne({
            _id: req.params.id,
            acceptedBy: req.session.userId,
            status: { $in: ['accepted', 'reached', 'completed'] }
        });

        if (!emergencyRequest) {
            return res.redirect('/ambulance/dashboard');
        }

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
        const emergencyRequest = await EmergencyRequest.findOneAndUpdate(
            { _id: req.params.id, acceptedBy: req.session.userId, status: 'accepted' },
            { status: 'reached' },
            { new: true }
        );
        if (!emergencyRequest) {
            return res.status(404).json({ success: false, message: 'Request not found or already reached' });
        }
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
        const emergencyRequest = await EmergencyRequest.findOneAndUpdate(
            { _id: req.params.id, acceptedBy: req.session.userId },
            { 
                status: 'completed',
                hospitalAdmitted: hospitalName
            },
            { new: true }
        );
        res.redirect('/ambulance/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
