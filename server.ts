import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
// @ts-ignore - SvelteKit handler will exist after build
import { handler } from '../build/handler.js';
import { initializeDatabase } from './server/db/index.js';
import authRoutes from './server/routes/auth.js';
import movesRoutes from './server/routes/moves.js';
import contributorsRoutes from './server/routes/contributors.js';

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize database
initializeDatabase();

// CORS for API routes (SvelteKit handles its own CORS)
const corsOptions = {
    origin: true, // Allow all origins in production since it's same-domain
    credentials: true
};

// Middleware
app.use(express.json());

// API Routes (with CORS)
app.use('/api/auth', cors(corsOptions), authRoutes);
app.use('/api/moves', cors(corsOptions), movesRoutes);
app.use('/api/contributors', cors(corsOptions), contributorsRoutes);

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling for API routes
app.use('/api', (err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('API Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
});

// SvelteKit handler for all other routes
app.use(handler);

app.listen(PORT, () => {
    console.log(`🚀 Shpole production server running on port ${PORT}`);
});
