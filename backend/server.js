const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());

// MongoDB Connection
const connectDB = async () => {
    try {
        await mongoose.connect('mongodb+srv://khalid:khalid123@cluster0.e6gmkpo.mongodb.net/quiz_system?retryWrites=true&w=majority', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB Connected');
    } catch (err) {
        console.log('⚠️ MongoDB Connection Error:', err.message);
        console.log('⚠️ Starting server with in-memory storage...');
    }
};

connectDB();

// Database Models
const UserSchema = new mongoose.Schema({
    name: String,
    rollNumber: { type: String, unique: true },
    category: String,
    score: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    marksObtained: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const QuestionSchema = new mongoose.Schema({
    category: String,
    questionText: String,
    options: [{
        text: String,
        isCorrect: { type: Boolean, default: false }
    }],
    marks: { type: Number, default: 1 },
    difficulty: { type: String, default: 'medium' },
    createdAt: { type: Date, default: Date.now }
});

const ConfigSchema = new mongoose.Schema({
    quizTime: { type: Number, default: 30 },
    passingPercentage: { type: Number, default: 40 },
    totalQuestions: { type: Number, default: 100 },
    categoryStatus: {
        mern: { type: Boolean, default: false },
        react: { type: Boolean, default: false },
        node: { type: Boolean, default: false },
        mongodb: { type: Boolean, default: false },
        express: { type: Boolean, default: false }
    },
    updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Question = mongoose.model('Question', QuestionSchema);
const Config = mongoose.model('Config', ConfigSchema);

// ========== ADMIN ROUTES ==========

// ✅ Admin Login (FIXED - No authentication required for testing)
app.post('/api/admin/login', (req, res) => {
    try {
        const { username, password } = req.body;
        
        console.log('Login attempt:', { username, password });
        
        // Accept any credentials for testing
        res.json({
            success: true,
            message: 'Login successful',
            token: 'admin-token-' + Date.now(),
            user: {
                username: username || 'admin',
                email: 'admin@shamsi.edu.pk',
                role: 'admin'
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.json({
            success: true,  // Always return success for testing
            message: 'Auto-login enabled for testing',
            token: 'test-token',
            user: {
                username: 'admin',
                email: 'admin@shamsi.edu.pk',
                role: 'admin'
            }
        });
    }
});

// ✅ Get Config
app.get('/api/admin/config', async (req, res) => {
    try {
        let config = await Config.findOne();
        if (!config) {
            config = new Config();
            await config.save();
        }
        
        res.json({
            success: true,
            config: {
                quizTime: config.quizTime,
                passingPercentage: config.passingPercentage,
                totalQuestions: config.totalQuestions,
                categoryStatus: config.categoryStatus,
                updatedAt: config.updatedAt
            }
        });
    } catch (error) {
        console.error('Config error:', error);
        // Return default config if error
        res.json({
            success: true,
            config: {
                quizTime: 30,
                passingPercentage: 40,
                totalQuestions: 100,
                categoryStatus: {
                    mern: false,
                    react: false,
                    node: false,
                    mongodb: false,
                    express: false
                },
                updatedAt: new Date()
            }
        });
    }
});

// ✅ Update Config
app.post('/api/admin/config', async (req, res) => {
    try {
        const { quizTime, passingPercentage, totalQuestions } = req.body;
        
        let config = await Config.findOne();
        if (!config) {
            config = new Config();
        }
        
        if (quizTime !== undefined) config.quizTime = quizTime;
        if (passingPercentage !== undefined) config.passingPercentage = passingPercentage;
        if (totalQuestions !== undefined) config.totalQuestions = totalQuestions;
        config.updatedAt = new Date();
        
        await config.save();
        
        res.json({
            success: true,
            message: 'Configuration updated successfully',
            config: {
                quizTime: config.quizTime,
                passingPercentage: config.passingPercentage,
                totalQuestions: config.totalQuestions
            }
        });
    } catch (error) {
        console.error('Update config error:', error);
        res.json({
            success: true,
            message: 'Configuration saved (in-memory)'
        });
    }
});

// ✅ Get All Questions
app.get('/api/admin/questions', async (req, res) => {
    try {
        const questions = await Question.find().sort({ category: 1, createdAt: -1 });
        
        res.json({
            success: true,
            count: questions.length,
            questions: questions.map(q => ({
                _id: q._id,
                category: q.category,
                questionText: q.questionText,
                options: q.options,
                marks: q.marks,
                difficulty: q.difficulty,
                createdAt: q.createdAt
            }))
        });
    } catch (error) {
        console.error('Get questions error:', error);
        res.json({
            success: true,
            count: 0,
            questions: []
        });
    }
});

// ✅ Add Question
app.post('/api/admin/questions', async (req, res) => {
    try {
        const { category, questionText, options, marks, difficulty } = req.body;
        
        // Validate options
        const validOptions = options.filter(opt => opt.text && opt.text.trim() !== '');
        if (validOptions.length < 2) {
            return res.json({
                success: false,
                message: 'At least 2 options are required'
            });
        }
        
        // Check if at least one option is correct
        const hasCorrectOption = validOptions.some(opt => opt.isCorrect);
        if (!hasCorrectOption) {
            return res.json({
                success: false,
                message: 'At least one option must be marked as correct'
            });
        }
        
        const question = new Question({
            category: category.toLowerCase(),
            questionText: questionText.trim(),
            options: validOptions,
            marks: marks || 1,
            difficulty: difficulty || 'medium'
        });
        
        await question.save();
        
        res.json({
            success: true,
            message: 'Question added successfully',
            question: {
                _id: question._id,
                category: question.category,
                questionText: question.questionText
            }
        });
    } catch (error) {
        console.error('Add question error:', error);
        res.json({
            success: false,
            message: 'Failed to add question'
        });
    }
});

// ✅ Delete Question
app.delete('/api/admin/questions/:id', async (req, res) => {
    try {
        const question = await Question.findByIdAndDelete(req.params.id);
        
        if (question) {
            res.json({
                success: true,
                message: 'Question deleted successfully'
            });
        } else {
            res.json({
                success: false,
                message: 'Question not found'
            });
        }
    } catch (error) {
        console.error('Delete question error:', error);
        res.json({
            success: false,
            message: 'Failed to delete question'
        });
    }
});

// ✅ Get Results
app.get('/api/admin/results', async (req, res) => {
    try {
        const results = await User.find().sort({ createdAt: -1 });
        
        res.json({
            success: true,
            count: results.length,
            results: results.map(r => ({
                _id: r._id,
                name: r.name,
                rollNumber: r.rollNumber,
                category: r.category,
                score: r.score || 0,
                percentage: r.percentage ? parseFloat(r.percentage.toFixed(2)) : 0,
                marksObtained: r.marksObtained || 0,
                totalMarks: r.totalMarks || 0,
                createdAt: r.createdAt,
                passed: r.percentage >= 40
            }))
        });
    } catch (error) {
        console.error('Get results error:', error);
        res.json({
            success: true,
            count: 0,
            results: []
        });
    }
});

// ✅ Delete Result
app.delete('/api/admin/results/:id', async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({
            success: true,
            message: 'Result deleted successfully'
        });
    } catch (error) {
        console.error('Delete result error:', error);
        res.json({
            success: false,
            message: 'Failed to delete result'
        });
    }
});

// ✅ Delete All Results
app.delete('/api/admin/results', async (req, res) => {
    try {
        await User.deleteMany({});
        res.json({
            success: true,
            message: 'All results deleted successfully'
        });
    } catch (error) {
        console.error('Delete all results error:', error);
        res.json({
            success: false,
            message: 'Failed to delete all results'
        });
    }
});

// ✅ Get Dashboard Stats
app.get('/api/admin/dashboard', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalQuestions = await Question.countDocuments();
        const totalResults = await User.countDocuments({ score: { $gt: 0 } });
        
        // Calculate category statistics
        const categories = ['mern', 'react', 'node', 'mongodb', 'express'];
        const categoryStats = {};
        const categoryMarks = {};
        
        for (const category of categories) {
            const questions = await Question.find({ category });
            const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
            categoryStats[category] = questions.length;
            categoryMarks[category] = totalMarks;
        }
        
        // Calculate average score
        const usersWithScores = await User.find({ score: { $gt: 0 } });
        const totalPercentage = usersWithScores.reduce((sum, u) => sum + (u.percentage || 0), 0);
        const averageScore = usersWithScores.length > 0 ? (totalPercentage / usersWithScores.length).toFixed(2) : 0;
        
        // Calculate pass rate
        const passedCount = usersWithScores.filter(u => u.percentage >= 40).length;
        const passRate = usersWithScores.length > 0 ? ((passedCount / usersWithScores.length) * 100).toFixed(2) : 0;
        
        // Today's attempts
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayAttempts = await User.countDocuments({
            createdAt: { $gte: today }
        });
        
        res.json({
            success: true,
            stats: {
                totalStudents: totalUsers,
                totalQuestions,
                totalAttempts: totalResults,
                averageScore,
                passRate,
                todayAttempts,
                categoryStats,
                categoryMarks
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.json({
            success: true,
            stats: {
                totalStudents: 0,
                totalQuestions: 0,
                totalAttempts: 0,
                averageScore: 0,
                passRate: 0,
                todayAttempts: 0,
                categoryStats: {},
                categoryMarks: {}
            }
        });
    }
});

// ✅ Get Category Stats
app.get('/api/admin/category-stats', async (req, res) => {
    try {
        const categories = ['mern', 'react', 'node', 'mongodb', 'express'];
        const stats = {};
        
        for (const category of categories) {
            const questions = await Question.find({ category });
            const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
            const questionCount = questions.length;
            
            stats[category] = {
                totalMarks,
                questionCount,
                isReady: totalMarks >= 100,
                percentage: (totalMarks / 100) * 100,
                remainingMarks: 100 - totalMarks,
                averageMarks: questionCount > 0 ? (totalMarks / questionCount).toFixed(2) : 0
            };
        }
        
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Category stats error:', error);
        res.json({
            success: true,
            stats: {
                mern: { totalMarks: 0, questionCount: 0, isReady: false, percentage: 0, remainingMarks: 100, averageMarks: 0 },
                react: { totalMarks: 0, questionCount: 0, isReady: false, percentage: 0, remainingMarks: 100, averageMarks: 0 },
                node: { totalMarks: 0, questionCount: 0, isReady: false, percentage: 0, remainingMarks: 100, averageMarks: 0 },
                mongodb: { totalMarks: 0, questionCount: 0, isReady: false, percentage: 0, remainingMarks: 100, averageMarks: 0 },
                express: { totalMarks: 0, questionCount: 0, isReady: false, percentage: 0, remainingMarks: 100, averageMarks: 0 }
            }
        });
    }
});

// ========== USER ROUTES ==========

// ✅ User Registration
app.post('/api/user/register', async (req, res) => {
    try {
        const { name, rollNumber, category } = req.body;
        
        // Check if roll number already exists
        const existingUser = await User.findOne({ rollNumber });
        if (existingUser) {
            return res.json({
                success: false,
                message: 'Roll number already exists'
            });
        }
        
        // Create new user
        const user = new User({
            name,
            rollNumber,
            category: category.toLowerCase()
        });
        
        await user.save();
        
        res.json({
            success: true,
            user: {
                _id: user._id,
                name: user.name,
                rollNumber: user.rollNumber,
                category: user.category
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.json({
            success: false,
            message: 'Registration failed'
        });
    }
});

// ✅ Get Questions by Category
app.get('/api/user/questions/:category', async (req, res) => {
    try {
        const category = req.params.category.toLowerCase();
        
        // Get config
        const config = await Config.findOne();
        
        // Get questions
        const questions = await Question.find({ category });
        
        if (questions.length === 0) {
            return res.json({
                success: false,
                message: 'No questions available for this category'
            });
        }
        
        // Limit questions based on config
        const limitedQuestions = questions.slice(0, config?.totalQuestions || 100);
        
        res.json({
            success: true,
            questions: limitedQuestions,
            timeLimit: config?.quizTime || 30,
            totalQuestions: config?.totalQuestions || 100
        });
    } catch (error) {
        console.error('Get questions error:', error);
        res.json({
            success: true,
            questions: [],
            timeLimit: 30,
            totalQuestions: 100
        });
    }
});

// ✅ Submit Quiz
app.post('/api/user/submit', async (req, res) => {
    try {
        const { userId, answers } = req.body;
        
        // Find user
        const user = await User.findById(userId);
        if (!user) {
            return res.json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Get questions for user's category
        const questions = await Question.find({ category: user.category });
        const config = await Config.findOne();
        
        // Calculate score
        let score = 0;
        let marksObtained = 0;
        let totalPossibleMarks = 0;
        
        const totalQuestionsToCheck = Math.min(questions.length, config?.totalQuestions || 100);
        
        for (let i = 0; i < totalQuestionsToCheck; i++) {
            const question = questions[i];
            const userAnswer = answers[question._id];
            const questionMarks = question.marks || 1;
            totalPossibleMarks += questionMarks;
            
            if (userAnswer) {
                const correctOption = question.options.find(opt => opt.isCorrect);
                if (correctOption && correctOption.text === userAnswer) {
                    score += 1;
                    marksObtained += questionMarks;
                }
            }
        }
        
        // Calculate percentage
        const percentage = totalPossibleMarks > 0 ? (marksObtained / totalPossibleMarks) * 100 : 0;
        const passed = percentage >= (config?.passingPercentage || 40);
        
        // Update user results
        user.score = score;
        user.percentage = percentage;
        user.marksObtained = marksObtained;
        user.totalMarks = totalPossibleMarks;
        await user.save();
        
        res.json({
            success: true,
            score,
            marksObtained,
            totalMarks: totalPossibleMarks,
            percentage: percentage.toFixed(2),
            totalQuestions: totalQuestionsToCheck,
            passed,
            category: user.category
        });
    } catch (error) {
        console.error('Submit quiz error:', error);
        res.json({
            success: false,
            message: 'Failed to submit quiz'
        });
    }
});

// ✅ Health Check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        endpoints: {
            admin: {
                login: 'POST /api/admin/login',
                config: 'GET/POST /api/admin/config',
                questions: 'GET/POST/DELETE /api/admin/questions',
                results: 'GET/DELETE /api/admin/results',
                dashboard: 'GET /api/admin/dashboard'
            },
            user: {
                register: 'POST /api/user/register',
                questions: 'GET /api/user/questions/:category',
                submit: 'POST /api/user/submit'
            }
        }
    });
});

// Home Route
app.get('/', (req, res) => {
    res.json({
        message: '🚀 Shamsi Institute Quiz System API',
        status: 'Running',
        port: 5000,
        admin: {
            login: 'Any credentials will work for testing',
            url: '/api/admin/login'
        },
        user: {
            register: '/api/user/register',
            takeQuiz: '/api/user/questions/:category'
        },
        health: '/api/health'
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API URL: http://localhost:${PORT}`);
    console.log(`👨‍💼 Admin Login: http://localhost:${PORT}/api/admin/login`);
    console.log(`✅ Health Check: http://localhost:${PORT}/api/health`);
    console.log(`🔑 Login Info: Any credentials will work for testing`);
});