const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Question = require('../models/Question');
const Config = require('../models/Config');

// 注册用户
router.post('/register', async (req, res) => {
    try {
        const { name, rollNumber, category } = req.body;
        
        // 检查类别是否可用
        const config = await Config.findOne();
        const isCategoryReady = config?.categoryStatus?.[category] || false;
        
        if (!isCategoryReady) {
            return res.status(400).json({
                success: false,
                message: `The ${category.toUpperCase()} category is not yet available for quizzes. Please select another category.`
            });
        }
        
        // 检查用户是否已存在
        const existingUser = await User.findOne({ rollNumber });
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: 'Roll number already exists' 
            });
        }
        
        // 创建新用户
        const user = new User({ 
            name, 
            rollNumber, 
            category 
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
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// 获取问题（仅当类别准备好时）
router.get('/questions/:category', async (req, res) => {
    try {
        const category = req.params.category.toLowerCase();
        
        // 检查类别是否准备好
        const config = await Config.findOne();
        const isCategoryReady = config?.categoryStatus?.[category] || false;
        
        if (!isCategoryReady) {
            return res.status(400).json({
                success: false,
                message: `The ${category.toUpperCase()} category is not yet available. It needs 100 total marks worth of questions.`
            });
        }
        
        const questions = await Question.find({ category });
        
        if (!config) {
            const newConfig = new Config();
            await newConfig.save();
        }
        
        res.json({
            success: true,
            questions: questions.slice(0, config?.totalQuestions || 100),
            timeLimit: config?.quizTime || 30,
            totalQuestions: config?.totalQuestions || 100,
            categoryInfo: {
                name: category.toUpperCase(),
                totalQuestions: questions.length,
                totalMarks: questions.reduce((sum, q) => sum + (q.marks || 1), 0)
            }
        });
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error loading questions' 
        });
    }
});

// 提交测验
router.post('/submit', async (req, res) => {
    try {
        const { userId, answers } = req.body;
        
        // 查找用户
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        // 获取配置
        const config = await Config.findOne();
        
        // 获取用户类别的问题
        const questions = await Question.find({ category: user.category });
        
        // 计算分数
        let score = 0;
        let totalMarksObtained = 0;
        let totalPossibleMarks = 0;
        
        const totalQuestionsToCheck = Math.min(questions.length, config?.totalQuestions || 100);
        
        for (let i = 0; i < totalQuestionsToCheck; i++) {
            const question = questions[i];
            const userAnswer = answers[question._id];
            
            if (userAnswer) {
                const correctOption = question.options.find(opt => opt.isCorrect);
                if (correctOption && correctOption.text === userAnswer) {
                    score += 1;
                    totalMarksObtained += question.marks || 1;
                }
            }
            totalPossibleMarks += question.marks || 1;
        }
        
        // 计算百分比
        const percentage = totalPossibleMarks > 0 ? (totalMarksObtained / totalPossibleMarks) * 100 : 0;
        const passed = percentage >= (config?.passingPercentage || 40);
        
        // 更新用户结果
        user.score = score;
        user.percentage = percentage;
        user.marksObtained = totalMarksObtained;
        user.totalMarks = totalPossibleMarks;
        await user.save();
        
        res.json({
            success: true,
            score,
            marksObtained: totalMarksObtained,
            totalMarks: totalPossibleMarks,
            percentage: percentage.toFixed(2),
            totalQuestions: totalQuestionsToCheck,
            passed,
            category: user.category,
            grade: passed ? 'PASS' : 'FAIL'
        });
    } catch (error) {
        console.error('Submit error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error submitting quiz' 
        });
    }
});

module.exports = router;