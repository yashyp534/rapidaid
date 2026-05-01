const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Middleware to redirect logged in users
const redirectIfLoggedIn = (req, res, next) => {
    if (req.session.userId) {
        const requestedRole = req.query.role;
        if (requestedRole && requestedRole !== req.session.role) {
            req.session.destroy(() => {
                next();
            });
            return;
        }
        if (req.session.role === 'user') return res.redirect('/user/dashboard');
        if (req.session.role === 'ambulance') return res.redirect('/ambulance/dashboard');
    }
    next();
};

// Landing Page
router.get('/', redirectIfLoggedIn, (req, res) => {
    res.render('index');
});

// Login Page
router.get('/login', redirectIfLoggedIn, (req, res) => {
    const role = req.query.role || 'user';
    res.render('login', { role, error: null });
});

// Login POST
router.post('/login', async (req, res) => {
    const { email, password, role } = req.body;
    try {
        const user = await User.findOne({ email, role });
        if (!user) {
            return res.render('login', { role, error: 'Invalid credentials or wrong role selected.' });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('login', { role, error: 'Invalid credentials.' });
        }

        // Set session
        req.session.userId = user._id;
        req.session.name = user.name;
        req.session.role = user.role;
        
        if (role === 'user') return res.redirect('/user/dashboard');
        return res.redirect('/ambulance/dashboard');
    } catch (err) {
        console.error(err);
        res.render('login', { role, error: 'Server error. Please try again later.' });
    }
});

// Signup Page
router.get('/signup', redirectIfLoggedIn, (req, res) => {
    const role = req.query.role || 'user';
    res.render('signup', { role, error: null });
});

// Signup POST
router.post('/signup', async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
        if (!name || !email || !password) {
            return res.render('signup', { role, error: 'All fields are required.' });
        }

        let user = await User.findOne({ email });
        if (user) {
            return res.render('signup', { role, error: 'Email already exists.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({
            name,
            email,
            password: hashedPassword,
            role
        });

        await user.save();
        res.redirect(`/login?role=${role}`);
    } catch (err) {
        console.error("Signup Error:", err);
        let errorMsg = 'Server error. Please try again later.';
        
        if (err.name === 'ValidationError') {
            errorMsg = Object.values(err.errors).map(e => e.message).join(', ');
        } else if (err.code === 11000) {
            errorMsg = 'Email already exists.';
        } else {
            // Temporarily show full error for debugging
            errorMsg = `Server Error: ${err.name} - ${err.message}`;
        }
        
        res.render('signup', { role, error: errorMsg });
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

module.exports = router;
