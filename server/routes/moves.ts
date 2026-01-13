import { Router } from 'express';
import db from '../db/index.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

interface MoveRow {
    Id: number;
    Slug: string;
    PdcName: string | null;
    PdcLevel: number | null;
    StrengthReq: number | null;
    FlexibilityReq: number | null;
    TechniqueReq: number | null;
    MoveTypeName: string | null;
    Info: string | null;
    ThumbnailUrl: string | null;
    Status: number;
}

interface MoveDetailRow extends MoveRow {
    IpsfCode: string | null;
    IpsfName: string | null;
    IpsfValue: number | null;
    IpsfCriteria: string | null;
    PosaCode: string | null;
    PosaName: string | null;
    PosaValue: number | null;
    PosaCriteria: string | null;
    PsoLevel: number | null;
    GripTypeId: number | null;
    AuthorId: number | null;
    CreatedDate: string;
}

// Get all moves (for home page list)
router.get('/', (req, res) => {
    try {
        const moves = db.prepare(`
            SELECT 
                m.Id,
                mn.Slug,
                m.PdcName,
                m.PdcLevel,
                m.StrengthReq,
                m.FlexibilityReq,
                m.TechniqueReq,
                mt.Name as MoveTypeName
            FROM Moves m
            LEFT JOIN MoveTypes mt ON m.MoveTypeId = mt.Id
            LEFT JOIN Move_Name m_n ON m.Id = m_n.MoveId
            LEFT JOIN MoveNames mn ON m_n.NameId = mn.Id
            GROUP BY m.Id
            ORDER BY m.PdcLevel ASC, m.PdcName ASC
        `).all() as MoveRow[];

        res.json({ moves });
    } catch (error) {
        console.error('Get moves error:', error);
        res.status(500).json({ error: 'Failed to get moves' });
    }
});

// Get single move by slug
router.get('/:slug', (req, res) => {
    try {
        const { slug } = req.params;

        const move = db.prepare(`
            SELECT 
                m.*,
                mt.Name as MoveTypeName,
                mn.Slug
            FROM Moves m
            LEFT JOIN MoveTypes mt ON m.MoveTypeId = mt.Id
            LEFT JOIN Move_Name m_n ON m.Id = m_n.MoveId
            LEFT JOIN MoveNames mn ON m_n.NameId = mn.Id
            WHERE mn.Slug = ?
        `).get(slug) as MoveDetailRow | undefined;

        if (!move) {
            return res.status(404).json({ error: 'Move not found' });
        }

        // Get alternative names
        const names = db.prepare(`
            SELECT mn.MoveName, m_n.Source
            FROM Move_Name m_n
            JOIN MoveNames mn ON m_n.NameId = mn.Id
            WHERE m_n.MoveId = ?
        `).all(move.Id);

        // Get videos
        const videos = db.prepare(`
            SELECT v.Url, v.Credit, mv.TimeStart, mv.TimeEnd
            FROM Move_Video mv
            JOIN Videos v ON mv.VideoId = v.Id
            WHERE mv.MoveId = ?
        `).all(move.Id);

        // Get prerequisites
        const prerequisites = db.prepare(`
            SELECT pmn.Slug, pm.PdcName
            FROM Move_Prerequisite mp
            JOIN Moves pm ON mp.PrereqId = pm.Id
            LEFT JOIN Move_Name pm_n ON pm.Id = pm_n.MoveId
            LEFT JOIN MoveNames pmn ON pm_n.NameId = pmn.Id
            WHERE mp.MoveId = ?
            GROUP BY pm.Id
        `).all(move.Id);

        // Get related moves
        const relatedMoves = db.prepare(`
            SELECT rmn.Slug, rm.PdcName, mr.RelationType
            FROM Move_Relation mr
            JOIN Moves rm ON mr.RelatedMoveId = rm.Id
            LEFT JOIN Move_Name rm_n ON rm.Id = rm_n.MoveId
            LEFT JOIN MoveNames rmn ON rm_n.NameId = rmn.Id
            WHERE mr.MoveId = ?
            GROUP BY rm.Id, mr.RelationType
        `).all(move.Id);

        // Get requirement details
        const requirementDetails = db.prepare(`
            SELECT Dimension, Level, Notes
            FROM Move_RequirementDetail
            WHERE MoveId = ?
        `).all(move.Id);

        res.json({
            move,
            names,
            videos,
            prerequisites,
            relatedMoves,
            requirementDetails
        });
    } catch (error) {
        console.error('Get move error:', error);
        res.status(500).json({ error: 'Failed to get move' });
    }
});

export default router;
