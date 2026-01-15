const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const Config = require('../models/Config');
const User = require('../models/User');
const Admin = require('../models/Admin');

// ✅ 检查类别是否准备好（达到100分）
const checkCategoryReady = async (category) => {
    try {
        const questions = await Question.find({ category: category });
        const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
        return totalMarks >= 100;
    } catch (error) {
        console.error('Error checking category ready:', error);
        return false;
    }
};

// ✅ 更新所有类别状态
const updateAllCategoryStatus = async () => {
    try {
        const categories = ['mern', 'react', 'node', 'mongodb', 'express'];
        const categoryStatus = {};
        
        for (const category of categories) {
            categoryStatus[category] = await checkCategoryReady(category);
        }
        
        let config = await Config.findOne();
        if (!config) {
            config = new Config({ categoryStatus });
        } else {
            config.categoryStatus = categoryStatus;
            config.updatedAt = new Date();
        }
        
        await config.save();
        return categoryStatus;
    } catch (error) {
        console.error('Error updating category status:', error);
        return null;
    }
};

// ✅ 获取可用测验类别（只有达到100分的类别）
router.get('/available-categories', async (req, res) => {
    try {
        const config = await Config.findOne();
        const availableCategories = [];
        
        const categories = [
            { value: 'mern', label: 'MERN Stack', icon: '⚛️' },
            { value: 'react', label: 'React.js', icon: '⚛️' },
            { value: 'node', label: 'Node.js', icon: '🟢' },
            { value: 'mongodb', label: 'MongoDB', icon: '🍃' },
            { value: 'express', label: 'Express.js', icon: '🚀' }
        ];
        
        for (const cat of categories) {
            const isReady = config?.categoryStatus?.[cat.value] || false;
            if (isReady) {
                // 计算该类别的总分数
                const questions = await Question.find({ category: cat.value });
                const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
                
                availableCategories.push({
                    ...cat,
                    totalMarks,
                    questionCount: questions.length,
                    isReady: true
                });
            }
        }
        
        res.json({
            success: true,
            categories: availableCategories,
            totalAvailable: availableCategories.length
        });
    } catch (error) {
        console.error('Error fetching available categories:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch available categories'
        });
    }
});

// ✅ 添加问题并更新类别状态
router.post('/questions', async (req, res) => {
    try {
        const { category, questionText, options, marks, difficulty } = req.body;
        
        // 验证必填字段
        if (!category || !questionText || !options || options.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Category, question text, and options are required'
            });
        }
        
        // 检查该类别的当前总分
        const existingQuestions = await Question.find({ category: category.toLowerCase() });
        const currentTotalMarks = existingQuestions.reduce((sum, q) => sum + (q.marks || 1), 0);
        const newQuestionMarks = marks || 1;
        
        // 检查是否会超过100分
        if (currentTotalMarks + newQuestionMarks > 100) {
            const remaining = 100 - currentTotalMarks;
            return res.status(400).json({
                success: false,
                message: `Cannot add question. Category "${category}" already has ${currentTotalMarks}/100 marks. Only ${remaining} marks remaining.`,
                currentMarks: currentTotalMarks,
                remainingMarks: remaining
            });
        }
        
        // 创建新问题
        const question = new Question({
            category: category.toLowerCase(),
            questionText: questionText.trim(),
            options: options.map(opt => ({
                text: opt.text.trim(),
                isCorrect: opt.isCorrect || false
            })),
            marks: newQuestionMarks,
            difficulty: difficulty || 'medium'
        });
        
        await question.save();
        
        // 检查添加后类别是否达到100分
        const newTotalMarks = currentTotalMarks + newQuestionMarks;
        const isCategoryReady = newTotalMarks >= 100;
        
        // 更新配置中的类别状态
        await updateAllCategoryStatus();
        
        res.json({
            success: true,
            message: '✅ Question added successfully!',
            question: {
                id: question._id,
                category: question.category,
                questionText: question.questionText,
                options: question.options,
                marks: question.marks,
                difficulty: question.difficulty
            },
            categoryStatus: {
                currentMarks: newTotalMarks,
                isReady: isCategoryReady,
                remaining: 100 - newTotalMarks
            }
        });
    } catch (error) {
        console.error('❌ Add question error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add question',
            error: error.message
        });
    }
});

// ✅ 获取类别统计信息
router.get('/category-stats', async (req, res) => {
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
            stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching category stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch category statistics'
        });
    }
});

// ✅ 获取完整仪表板数据
router.get('/dashboard-full', async (req, res) => {
    try {
        // 基本统计
        const totalUsers = await User.countDocuments();
        const totalQuestions = await Question.countDocuments();
        const totalResults = await User.countDocuments({ score: { $gt: 0 } });
        
        // 类别统计
        const categoryStats = await Question.aggregate([
            {
                $group: {
                    _id: '$category',
                    totalMarks: { $sum: '$marks' },
                    questionCount: { $sum: 1 },
                    averageMarks: { $avg: '$marks' }
                }
            }
        ]);
        
        // 最近结果
        const recentResults = await User.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('name rollNumber category score percentage createdAt');
        
        // 今天的结果
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayResults = await User.countDocuments({
            createdAt: { $gte: today }
        });
        
        // 配置信息
        const config = await Config.findOne();
        
        // 类别准备状态
        const categories = ['mern', 'react', 'node', 'mongodb', 'express'];
        const categoryStatus = {};
        for (const cat of categories) {
            const questions = await Question.find({ category: cat });
            const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
            categoryStatus[cat] = {
                totalMarks,
                questionCount: questions.length,
                isReady: totalMarks >= 100,
                percentage: (totalMarks / 100) * 100,
                remaining: 100 - totalMarks
            };
        }
        
        res.json({
            success: true,
            stats: {
                totalUsers,
                totalQuestions,
                totalResults,
                todayResults,
                categoryStats,
                recentResults,
                categoryStatus,
                config: config || {
                    quizTime: 30,
                    passingPercentage: 40,
                    totalQuestions: 100
                }
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get dashboard data'
        });
    }
});

// ✅ 强制更新类别状态
router.post('/update-category-status', async (req, res) => {
    try {
        const categoryStatus = await updateAllCategoryStatus();
        res.json({
            success: true,
            message: 'Category status updated successfully',
            categoryStatus
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ✅ 删除问题并更新状态
router.delete('/questions/:id', async (req, res) => {
    try {
        const question = await Question.findById(req.params.id);
        
        if (!question) {
            return res.status(404).json({
                success: false,
                message: 'Question not found'
            });
        }
        
        const category = question.category;
        await Question.findByIdAndDelete(req.params.id);
        
        // 更新类别状态
        await updateAllCategoryStatus();
        
        res.json({
            success: true,
            message: '✅ Question deleted successfully!',
            deletedQuestion: {
                id: question._id,
                category: question.category,
                questionText: question.questionText
            }
        });
    } catch (error) {
        console.error('Delete question error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete question'
        });
    }
});

module.exports = router;