import { Router } from 'express';
import db from '../db/index.js';

const router = Router();

// Get contributor profile by username
router.get('/:username', (req, res) => {
    try {
        const { username } = req.params;

        const user = db.prepare(`
            SELECT Id, UserName, CreatedDate
            FROM Principals
            WHERE UserName = ?
        `).get(username) as { Id: number; UserName: string; CreatedDate: string } | undefined;

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Count contributions
        const moveCount = db.prepare(`
            SELECT COUNT(*) as count FROM Moves WHERE AuthorId = ?
        `).get(user.Id) as { count: number };

        const nameCount = db.prepare(`
            SELECT COUNT(*) as count FROM Move_Name WHERE AuthorId = ?
        `).get(user.Id) as { count: number };

        res.json({
            user: {
                username: user.UserName,
                createdDate: user.CreatedDate
            },
            stats: {
                movesContributed: moveCount.count,
                namesContributed: nameCount.count
            }
        });
    } catch (error) {
        console.error('Get contributor error:', error);
        res.status(500).json({ error: 'Failed to get contributor' });
    }
});

export default router;
