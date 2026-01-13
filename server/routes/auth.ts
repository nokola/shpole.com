import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/index.js';
import { authenticateToken, generateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { email, password, username } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if email already exists
        const existingUser = db.prepare('SELECT Id FROM Principals WHERE Email = ?').get(email);
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const result = db.prepare(
            'INSERT INTO Principals (Email, PasswordHash, UserName) VALUES (?, ?, ?)'
        ).run(email, passwordHash, username || null);

        const user = {
            id: result.lastInsertRowid as number,
            email,
            username: username || null
        };

        const token = generateToken(user);

        res.status(201).json({
            user: { id: user.id, email: user.email, username: user.username },
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
            'SELECT Id, Email, UserName, PasswordHash FROM Principals WHERE Email = ?'
        ).get(email) as { Id: number; Email: string; UserName: string | null; PasswordHash: string } | undefined;

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
            username: user.UserName
        });

        res.json({
            user: { id: user.Id, email: user.Email, username: user.UserName },
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

        // Validate username format (alphanumeric, underscores, 3-30 chars)
        if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
            return res.status(400).json({
                error: 'Username must be 3-30 characters and contain only letters, numbers, and underscores'
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
            username
        });

        res.json({
            user: { id: userId, email: req.user!.email, username },
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
            'SELECT Id, Email, UserName, CreatedDate FROM Principals WHERE Id = ?'
        ).get(req.user!.id) as { Id: number; Email: string; UserName: string | null; CreatedDate: string } | undefined;

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            user: {
                id: user.Id,
                email: user.Email,
                username: user.UserName,
                created_at: user.CreatedDate
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

export default router;
