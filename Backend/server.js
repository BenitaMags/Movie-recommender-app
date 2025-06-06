const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// AWS S3 Configuration
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const s3 = new AWS.S3();
const S3_BUCKET = process.env.S3_BUCKET_NAME || 'your-movie-media-bucket';

// Multer S3 configuration for file uploads
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: S3_BUCKET,
    acl: 'public-read',
    key: function (req, file, cb) {
      const timestamp = Date.now();
      const filename = `movies/${timestamp}-${file.originalname}`;
      cb(null, filename);
    }
  })
});

// MySQL Database connection
const dbConfig = {
  host: process.env.DB_HOST || 'database',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || 'movies',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'password123',
};

let connection;

async function connectToDatabase() {
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to MySQL database');
    return connection;
  } catch (error) {
    console.log('❌ Database connection failed:', error.message);
    return null;
  }
}

// Sample movies data with S3 media URLs
const movies = [
  {
    id: 1,
    title: "Quantum Nexus",
    year: 2024,
    genre: "sci-fi",
    rating: 4.8,
    duration: "142 min",
    description: "A mind-bending journey through parallel dimensions",
    poster_url: `https://${S3_BUCKET}.s3.amazonaws.com/posters/quantum-nexus.jpg`,
    trailer_url: `https://${S3_BUCKET}.s3.amazonaws.com/trailers/quantum-nexus.mp4`
  },
  {
    id: 2,
    title: "Shadow Protocol",
    year: 2024,
    genre: "action",
    rating: 4.5,
    duration: "128 min",
    description: "Elite agents face their greatest challenge",
    poster_url: `https://${S3_BUCKET}.s3.amazonaws.com/posters/shadow-protocol.jpg`,
    trailer_url: `https://${S3_BUCKET}.s3.amazonaws.com/trailers/shadow-protocol.mp4`
  },
  {
    id: 3,
    title: "The Last Symphony",
    year: 2024,
    genre: "drama",
    rating: 4.7,
    duration: "156 min",
    description: "A musician's final masterpiece",
    poster_url: `https://${S3_BUCKET}.s3.amazonaws.com/posters/last-symphony.jpg`,
    trailer_url: `https://${S3_BUCKET}.s3.amazonaws.com/trailers/last-symphony.mp4`
  },
  {
    id: 4,
    title: "Cosmic Comedy Club",
    year: 2024,
    genre: "comedy",
    rating: 4.2,
    duration: "98 min",
    description: "Laughs from across the galaxy",
    poster_url: `https://${S3_BUCKET}.s3.amazonaws.com/posters/cosmic-comedy.jpg`,
    trailer_url: `https://${S3_BUCKET}.s3.amazonaws.com/trailers/cosmic-comedy.mp4`
  },
  {
    id: 5,
    title: "Digital Phantom",
    year: 2024,
    genre: "thriller",
    rating: 4.6,
    duration: "134 min",
    description: "Reality and virtuality collide",
    poster_url: `https://${S3_BUCKET}.s3.amazonaws.com/posters/digital-phantom.jpg`,
    trailer_url: `https://${S3_BUCKET}.s3.amazonaws.com/trailers/digital-phantom.mp4`
  },
  {
    id: 6,
    title: "Neon Nights",
    year: 2024,
    genre: "action",
    rating: 4.4,
    duration: "118 min",
    description: "Cyberpunk adventure in Neo-Tokyo",
    poster_url: `https://${S3_BUCKET}.s3.amazonaws.com/posters/neon-nights.jpg`,
    trailer_url: `https://${S3_BUCKET}.s3.amazonaws.com/trailers/neon-nights.mp4`
  }
];

// Initialize database (create tables if they don't exist)
async function initDatabase() {
  try {
    const conn = await connectToDatabase();
    if (!conn) {
      console.log('⚠️ Database not available, using in-memory data');
      return;
    }

    // Create movies table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS movies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        year INT,
        genre VARCHAR(100),
        rating DECIMAL(2,1),
        duration VARCHAR(50),
        description TEXT,
        poster_url VARCHAR(500),
        trailer_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Check if table has data
    const [rows] = await conn.execute('SELECT COUNT(*) as count FROM movies');
    if (rows[0].count === 0) {
      // Insert sample data
      for (const movie of movies) {
        await conn.execute(
          'INSERT INTO movies (title, year, genre, rating, duration, description, poster_url, trailer_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [movie.title, movie.year, movie.genre, movie.rating, movie.duration, movie.description, movie.poster_url, movie.trailer_url]
        );
      }
      console.log('✅ Sample movies added to MySQL database');
    }
  } catch (err) {
    console.log('⚠️ Database initialization error:', err.message);
    console.log('Using in-memory data instead');
  }
}

// Helper function to execute database queries
async function executeQuery(query, params = []) {
  try {
    if (!connection) {
      connection = await connectToDatabase();
    }
    if (connection) {
      const [rows] = await connection.execute(query, params);
      return rows;
    }
    return null;
  } catch (error) {
    console.log('Query error:', error.message);
    return null;
  }
}

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'Movie Backend',
    database: connection ? 'Connected' : 'Disconnected',
    s3_bucket: S3_BUCKET
  });
});

// Upload movie poster or trailer
app.post('/api/upload', upload.single('media'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  res.json({
    message: 'File uploaded successfully',
    url: req.file.location,
    key: req.file.key
  });
});

// Get all movies
app.get('/api/movies', async (req, res) => {
  try {
    const { genre, search, limit = 20, offset = 0 } = req.query;
    
    let movieList = movies;
    let query = 'SELECT * FROM movies';
    let params = [];
    let whereConditions = [];
    
    // Try database first
    const dbMovies = await executeQuery('SELECT * FROM movies ORDER BY rating DESC');
    if (dbMovies && dbMovies.length > 0) {
      movieList = dbMovies;
      
      // Build dynamic query for filtering
      if (genre && genre !== 'all') {
        whereConditions.push('genre = ?');
        params.push(genre);
      }
      
      if (search) {
        whereConditions.push('(title LIKE ? OR description LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }
      
      if (whereConditions.length > 0) {
        query += ' WHERE ' + whereConditions.join(' AND ');
      }
      
      query += ' ORDER BY rating DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));
      
      const filteredMovies = await executeQuery(query, params);
      if (filteredMovies) {
        movieList = filteredMovies;
      }
    } else {
      // Fall back to in-memory filtering
      if (genre && genre !== 'all') {
        movieList = movieList.filter(movie => movie.genre === genre);
      }
      
      if (search) {
        const searchTerm = search.toLowerCase();
        movieList = movieList.filter(movie => 
          movie.title.toLowerCase().includes(searchTerm) ||
          movie.description.toLowerCase().includes(searchTerm)
        );
      }
      
      // Apply pagination to in-memory data
      const start = parseInt(offset);
      const end = start + parseInt(limit);
      movieList = movieList.slice(start, end);
    }
    
    res.json({
      movies: movieList,
      total: movieList.length,
      page: Math.floor(parseInt(offset) / parseInt(limit)) + 1,
      limit: parseInt(limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single movie
app.get('/api/movies/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Try database first
    const dbMovie = await executeQuery('SELECT * FROM movies WHERE id = ?', [id]);
    if (dbMovie && dbMovie.length > 0) {
      return res.json(dbMovie[0]);
    }
    
    // Fall back to in-memory data
    const movie = movies.find(m => m.id === id);
    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    
    res.json(movie);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new movie
app.post('/api/movies', async (req, res) => {
  try {
    const { title, year, genre, rating, duration, description, poster_url, trailer_url } = req.body;
    
    // Validate required fields
    if (!title || !genre) {
      return res.status(400).json({ error: 'Title and genre are required' });
    }
    
    const insertQuery = `
      INSERT INTO movies (title, year, genre, rating, duration, description, poster_url, trailer_url) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await executeQuery(insertQuery, [
      title, year || null, genre, rating || null, duration || null, 
      description || null, poster_url || null, trailer_url || null
    ]);
    
    if (result) {
      res.status(201).json({ 
        message: 'Movie added successfully',
        id: result.insertId 
      });
    } else {
      res.status(500).json({ error: 'Failed to add movie to database' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get trending movies (highest rated)
app.get('/api/movies/trending', async (req, res) => {
  try {
    const limit = req.query.limit || 6;
    
    const dbMovies = await executeQuery(
      'SELECT * FROM movies ORDER BY rating DESC LIMIT ?', 
      [parseInt(limit)]
    );
    
    if (dbMovies && dbMovies.length > 0) {
      return res.json(dbMovies);
    }
    
    // Fall back to in-memory data
    const trendingMovies = movies
      .sort((a, b) => b.rating - a.rating)
      .slice(0, parseInt(limit));
    
    res.json(trendingMovies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Simple recommendations (movies from same genre)
app.get('/api/recommendations/:movieId', async (req, res) => {
  try {
    const movieId = parseInt(req.params.movieId);
    const limit = req.query.limit || 4;
    
    // Get the base movie first
    const baseMovie = await executeQuery('SELECT * FROM movies WHERE id = ?', [movieId]);
    
    if (!baseMovie || baseMovie.length === 0) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    
    const movie = baseMovie[0];
    
    // Get recommendations from same genre
    const recommendations = await executeQuery(
      'SELECT * FROM movies WHERE genre = ? AND id != ? ORDER BY rating DESC LIMIT ?',
      [movie.genre, movieId, parseInt(limit)]
    );
    
    if (recommendations) {
      return res.json({
        recommendations,
        basedOn: movie.title,
        genre: movie.genre
      });
    }
    
    // Fall back to in-memory data
    const inMemoryMovie = movies.find(m => m.id === movieId);
    if (!inMemoryMovie) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    
    const inMemoryRecs = movies
      .filter(m => m.genre === inMemoryMovie.genre && m.id !== movieId)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, parseInt(limit));
    
    res.json({
      recommendations: inMemoryRecs,
      basedOn: inMemoryMovie.title,
      genre: inMemoryMovie.genre
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get genres
app.get('/api/genres', async (req, res) => {
  try {
    const genres = await executeQuery('SELECT DISTINCT genre FROM movies ORDER BY genre');
    
    if (genres) {
      return res.json(genres.map(row => row.genre));
    }
    
    // Fall back to in-memory data
    const uniqueGenres = [...new Set(movies.map(movie => movie.genre))].sort();
    res.json(uniqueGenres);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete S3 object (utility endpoint)
app.delete('/api/s3/:key', async (req, res) => {
  try {
    const key = req.params.key;
    
    const params = {
      Bucket: S3_BUCKET,
      Key: key
    };
    
    await s3.deleteObject(params).promise();
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📦 S3 Bucket: ${S3_BUCKET}`);
  await initDatabase();
});
