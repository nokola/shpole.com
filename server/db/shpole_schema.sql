-- Shpole Move Database Schema
-- SQLite

PRAGMA foreign_keys = ON;

-- ============================================
-- Core Reference Tables
-- ============================================

CREATE TABLE IF NOT EXISTS Principals (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    UserName TEXT NOT NULL UNIQUE,
    Email TEXT NOT NULL UNIQUE,
    PasswordHash TEXT NOT NULL,
    Role TEXT NOT NULL DEFAULT 'user' CHECK (Role IN ('user', 'moderator', 'admin')),
    -- Permissions:
    -- user:      vote, suggest names, add videos, add new moves (Status=0 unverified)
    -- moderator: + edit moves, set Status=1 (community verified), change move names
    -- admin:     + everything (set Status=2 official, manage users, delete content)
    CreatedDate DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS MoveTypes (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL UNIQUE,
    Info TEXT
);

-- Seed MoveTypes (INSERT OR IGNORE to avoid duplicates)
INSERT OR IGNORE INTO MoveTypes (Name, Info) VALUES
    ('pose', NULL),
    ('spin', NULL),
    ('transition: move to move', NULL),
    ('transition: ascend', NULL),
    ('transition: descend', NULL),
    ('transition: dynamic', NULL),
    ('transition: rotation', NULL),
    ('grip', NULL),
    ('flip', NULL),
    ('flip-out', NULL),
    ('deadlift', NULL),
    ('drop', NULL),
    ('climb', NULL),
    ('handstand', NULL),
    ('floorwork', NULL),
    ('exercise', 'Used for some prereqs');

CREATE TABLE IF NOT EXISTS ContactPoints (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Type TEXT NOT NULL UNIQUE
);

-- ============================================
-- Main Tables
-- ============================================

CREATE TABLE IF NOT EXISTS MoveNames (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Slug TEXT NOT NULL UNIQUE, -- URL-friendly identifier, e.g. "jade", "iron-x"
    MoveName TEXT NOT NULL UNIQUE,
    AuthorId INTEGER REFERENCES Principals(Id),
    CreatedDate DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Moves (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- PDC (Pole Dance Community) data
    PdcName TEXT,
    PdcLevel INTEGER CHECK (PdcLevel BETWEEN 1 AND 6),
    
    -- IPSF (International Pole Sports Federation) data
    IpsfCode TEXT,
    IpsfName TEXT,
    IpsfValue REAL CHECK (IpsfValue BETWEEN 0 AND 1),
    IpsfCriteria TEXT,
    IpsfType INTEGER, -- 0 = flexibility, 1 = strength, etc.
    
    -- POSA data
    PosaCode TEXT,
    PosaName TEXT,
    PosaValue REAL CHECK (PosaValue BETWEEN 0 AND 1),
    PosaCriteria TEXT,
    
    -- PSO data
    PsoLevel INTEGER,
    
    -- General requirements (1-5 scale)
    ShpoleLevel INTEGER CHECK (ShpoleLevel BETWEEN 1 AND 5),
    StrengthReq INTEGER CHECK (StrengthReq BETWEEN 1 AND 5),
    FlexibilityReq INTEGER CHECK (FlexibilityReq BETWEEN 1 AND 5),
    TechniqueReq INTEGER CHECK (TechniqueReq BETWEEN 1 AND 5),
    
    -- Classification
    MoveTypeId INTEGER REFERENCES MoveTypes(Id),
    IsInvert INTEGER CHECK (IsInvert BETWEEN 0 AND 1),
    GripTypeId INTEGER REFERENCES Moves(Id), -- Self-reference to a grip-type move
    
    -- Content
    Info TEXT, -- Markdown format
    ThumbnailUrl TEXT,
    
    -- Metadata
    Status INTEGER DEFAULT 0, -- 0=stub, 1=community, 2=verified
    AuthorId INTEGER REFERENCES Principals(Id),
    CreatedDate DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Videos (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Url TEXT NOT NULL,
    Credit TEXT,
    AuthorId INTEGER REFERENCES Principals(Id),
    CreatedDate DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Junction / Relationship Tables
-- ============================================

CREATE TABLE IF NOT EXISTS Move_ContactPoint (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    MoveId INTEGER NOT NULL REFERENCES Moves(Id) ON DELETE CASCADE,
    ContactPointId INTEGER NOT NULL REFERENCES ContactPoints(Id),
    UNIQUE(MoveId, ContactPointId)
);

CREATE TABLE IF NOT EXISTS Move_Video (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    MoveId INTEGER NOT NULL REFERENCES Moves(Id) ON DELETE CASCADE,
    VideoId INTEGER NOT NULL REFERENCES Videos(Id) ON DELETE CASCADE,
    TimeStart REAL, -- Seconds
    TimeEnd REAL,   -- Seconds
    UNIQUE(MoveId, VideoId, TimeStart)
);

CREATE TABLE IF NOT EXISTS Move_Name (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    MoveId INTEGER NOT NULL REFERENCES Moves(Id) ON DELETE CASCADE,
    NameId INTEGER NOT NULL REFERENCES MoveNames(Id) ON DELETE CASCADE,
    Source TEXT CHECK (Source IN ('pdc', 'ipsf', 'posa', 'online')),
    AuthorId INTEGER REFERENCES Principals(Id),
    CreatedDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(MoveId, NameId)
);

CREATE TABLE IF NOT EXISTS Move_Prerequisite (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    MoveId INTEGER NOT NULL REFERENCES Moves(Id) ON DELETE CASCADE,
    PrereqId INTEGER NOT NULL REFERENCES Moves(Id) ON DELETE CASCADE,
    AuthorId INTEGER REFERENCES Principals(Id),
    CreatedDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(MoveId, PrereqId),
    CHECK (MoveId != PrereqId)
);

CREATE TABLE IF NOT EXISTS Move_SuggestedProgression (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    StartMoveId INTEGER NOT NULL REFERENCES Moves(Id) ON DELETE CASCADE,
    NextMoveId INTEGER NOT NULL REFERENCES Moves(Id) ON DELETE CASCADE,
    UNIQUE(StartMoveId, NextMoveId),
    CHECK (StartMoveId != NextMoveId)
);

CREATE TABLE IF NOT EXISTS Move_Relation (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    MoveId INTEGER NOT NULL REFERENCES Moves(Id) ON DELETE CASCADE,
    RelatedMoveId INTEGER NOT NULL REFERENCES Moves(Id) ON DELETE CASCADE,
    RelationType TEXT NOT NULL CHECK (RelationType IN ('variation', 'opposite_side', 'alternative_grip', 'easier_version')),
    UNIQUE(MoveId, RelatedMoveId, RelationType),
    CHECK (MoveId != RelatedMoveId)
);

CREATE TABLE IF NOT EXISTS Move_RequirementDetail (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    MoveId INTEGER NOT NULL REFERENCES Moves(Id) ON DELETE CASCADE,
    Dimension TEXT NOT NULL CHECK (Dimension IN (
        'strength_upper',
        'strength_core',
        'strength_grip',
        'flexibility_hips',
        'flexibility_shoulders',
        'flexibility_spine',
        'technique_balance',
        'technique_inversion_comfort'
    )),
    Level INTEGER NOT NULL CHECK (Level BETWEEN 1 AND 5),
    Notes TEXT,
    AuthorId INTEGER REFERENCES Principals(Id),
    CreatedDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(MoveId, Dimension)
);

CREATE TABLE IF NOT EXISTS Name_Vote (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    PrincipalId INTEGER NOT NULL REFERENCES Principals(Id) ON DELETE CASCADE,
    NameId INTEGER NOT NULL REFERENCES MoveNames(Id) ON DELETE CASCADE,
    Vote INTEGER NOT NULL CHECK (Vote IN (-1, 1)), -- -1=down, 1=up
    CreatedDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(PrincipalId, NameId)
);

-- ============================================
-- Indexes for common queries
-- ============================================

CREATE INDEX IF NOT EXISTS idx_movenames_slug ON MoveNames(Slug);
CREATE INDEX IF NOT EXISTS idx_moves_pdclevel ON Moves(PdcLevel);
CREATE INDEX IF NOT EXISTS idx_moves_movetype ON Moves(MoveTypeId);
CREATE INDEX IF NOT EXISTS idx_moves_status ON Moves(Status);
CREATE INDEX IF NOT EXISTS idx_move_name_moveid ON Move_Name(MoveId);
CREATE INDEX IF NOT EXISTS idx_move_name_nameid ON Move_Name(NameId);
CREATE INDEX IF NOT EXISTS idx_move_prereq_moveid ON Move_Prerequisite(MoveId);
CREATE INDEX IF NOT EXISTS idx_move_prereq_prereqid ON Move_Prerequisite(PrereqId);
CREATE INDEX IF NOT EXISTS idx_move_video_moveid ON Move_Video(MoveId);
CREATE INDEX IF NOT EXISTS idx_name_vote_nameid ON Name_Vote(NameId);