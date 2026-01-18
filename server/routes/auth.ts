import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/index.js';
import { authenticateToken, generateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { email, password, username } = req.body;

        if (!email || !password || !username) {
            return res.status(400).json({ error: 'Email, password, and username are required' });
        }

        // Validate username (GitHub rules: alphanumeric/hyphens, no start/end hyphen, no consecutive hyphens, max 39 chars)
        const usernameRegex = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
        if (!usernameRegex.test(username)) {
            return res.status(400).json({
                error: 'Username can only contain alphanumeric characters and single hyphens, and cannot start or end with a hyphen'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if email or username already exists
        const existingEmail = db.prepare('SELECT Id FROM Principals WHERE Email = ?').get(email);
        if (existingEmail) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const existingUsername = db.prepare('SELECT Id FROM Principals WHERE UserName = ?').get(username);
        if (existingUsername) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const result = db.prepare(
            'INSERT INTO Principals (Email, PasswordHash, UserName) VALUES (?, ?, ?)'
        ).run(email, passwordHash, username);

        const user = {
            id: result.lastInsertRowid as number,
            email,
            username: username || null,
            role: 'user' // Default role
        };

        const token = generateToken(user);

        res.status(201).json({
            user: { id: user.id, email: user.email, username: user.username, role: user.role },
            token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const user = db.prepare(
            'SELECT Id, Email, UserName, PasswordHash, Role FROM Principals WHERE Email = ?'
        ).get(email) as { Id: number; Email: string; UserName: string | null; PasswordHash: string; Role: string } | undefined;

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.PasswordHash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = generateToken({
            id: user.Id,
            email: user.Email,
            username: user.UserName,
            role: user.Role
        });

        res.json({
            user: { id: user.Id, email: user.Email, username: user.UserName, role: user.Role },
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Setup username (first login)
router.post('/setup-username', authenticateToken, (req: AuthRequest, res) => {
    try {
        const { username } = req.body;
        const userId = req.user!.id;

        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        // Validate username (GitHub rules: alphanumeric/hyphens, no start/end hyphen, no consecutive hyphens, max 39 chars)
        const usernameRegex = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
        if (!usernameRegex.test(username)) {
            return res.status(400).json({
                error: 'Username can only contain alphanumeric characters and single hyphens, and cannot start or end with a hyphen'
            });
        }

        // Check if username is taken
        const existing = db.prepare('SELECT Id FROM Principals WHERE UserName = ?').get(username);
        if (existing) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // Update username
        db.prepare('UPDATE Principals SET UserName = ? WHERE Id = ?').run(username, userId);

        const token = generateToken({
            id: userId,
            email: req.user!.email,
            username,
            role: req.user!.role
        });

        res.json({
            user: { id: userId, email: req.user!.email, username, role: req.user!.role },
            token
        });
    } catch (error) {
        console.error('Username setup error:', error);
        res.status(500).json({ error: 'Failed to set username' });
    }
});

// Get current user
router.get('/me', authenticateToken, (req: AuthRequest, res) => {
    try {
        const user = db.prepare(
            'SELECT Id, Email, UserName, CreatedDate, Role FROM Principals WHERE Id = ?'
        ).get(req.user!.id) as { Id: number; Email: string; UserName: string | null; CreatedDate: string; Role: string } | undefined;

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            user: {
                id: user.Id,
                email: user.Email,
                username: user.UserName,
                role: user.Role,
                created_at: user.CreatedDate
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

export default router;
