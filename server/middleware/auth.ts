import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'shpole-super-secret-key-change-in-production';

export interface AuthRequest extends Request {
    user?: {
        id: number;
        email: string;
        username: string | null;
        role: string;
    };
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as {
            id: number;
            email: string;
            username: string | null;
            role: string;
        };
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET) as {
                id: number;
                email: string;
                username: string | null;
                role: string;
            };
            req.user = decoded;
        } catch (err) {
            // Token invalid, but that's okay for optional auth
        }
    }
    next();
}

export function generateToken(user: { id: number; email: string; username: string | null; role: string }) {
    return jwt.sign(
        { id: user.id, email: user.email, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

export { JWT_SECRET };
