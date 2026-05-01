const express = require('express');
const router = express.Router();
const EmergencyRequest = require('../models/EmergencyRequest');

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
        const activeRequests = await EmergencyRequest.find({ 
            createdBy: req.session.userId, 
            status: { $in: ['pending', 'accepted'] } 
        }).sort({ createdAt: -1 });

        const historyRequests = await EmergencyRequest.find({ 
            createdBy: req.session.userId, 
            status: { $in: ['completed', 'rejected'] } 
        }).sort({ createdAt: -1 });

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
        
        const newRequest = new EmergencyRequest({
            patientName,
            phone,
            injuredCount: parseInt(injuredCount),
            location: {
                lat: parseFloat(lat),
                lng: parseFloat(lng)
            },
            createdBy: req.session.userId
        });

        await newRequest.save();
        res.redirect('/user/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Request Details Page
router.get('/request/:id', async (req, res) => {
    try {
        const emergencyRequest = await EmergencyRequest.findOne({ _id: req.params.id, createdBy: req.session.userId });
        if (!emergencyRequest) {
            return res.status(404).send('Request not found');
        }
        res.render('user/requestDetails', { emergencyRequest });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
