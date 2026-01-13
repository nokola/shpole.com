import express from 'express';
import cors from 'cors';
import { initializeDatabase } from './db/index.js';
import authRoutes from './routes/auth.js';
import movesRoutes from './routes/moves.js';
import contributorsRoutes from './routes/contributors.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
initializeDatabase();

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/moves', movesRoutes);
app.use('/api/contributors', contributorsRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Shpole API server running on http://localhost:${PORT}`);
});

export default app;
