const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const readData = (file, def = []) => {
    try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : def; } catch { return def; }
};
const writeData = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');

// Инициализация базы данных и дефолтного админа
let users = readData('users.json', {});
if (!users['admin@school.com']) {
    users['admin@school.com'] = { password: 'admin777', name: 'Директор', role: 'admin', class: 'all', coins: 1000, xp: 0, level: 1, badges: ['👑 Основатель'] };
    writeData('users.json', users);
}

app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Авторизация
app.post('/api/login', (req, res) => {
    const { email, password } = req.body; users = readData('users.json', {});
    const u = users[email];
    if (!u || u.password !== password) return res.status(400).json({ success: false, message: 'Неверные данные' });
    res.json({ success: true, role: u.role, user: { email, name: u.name, class: u.class, coins: u.coins || 0, xp: u.xp || 0, level: u.level || 1, badges: u.badges || [] } });
});

// Регистрация
app.post('/api/register', (req, res) => {
    const { email, password, name, schoolClass, role } = req.body; users = readData('users.json', {});
    if (users[email]) return res.status(400).json({ success: false, message: 'Email занят' });
    users[email] = { password, name, role: role || 'student', class: schoolClass, coins: 0, xp: 0, level: 1, badges: ['🎒 Новичок'] };
    writeData('users.json', users); res.json({ success: true, message: 'Успешно зарегистрировано!' });
});

// БЭКЕНД AI-ГЕНЕРАТОРА (Выдает полноценные структуры вопросов)
app.post('/api/ai/generate-test', (req, res) => {
    const { topic } = req.body;
    if (!topic) return res.status(400).json({ success: false });
    
    // Генерируем массив из вопросов
    const mockQuiz = {
        q: `Какое утверждение верно для темы "${topic}"?`,
        a: "Это фундаментальная основа науки",
        b: "Это второстепенный процесс",
        c: "Это применимо только в теории",
        d: "Это устаревший концепт"
    };
    res.json({ success: true, ...mockQuiz });
});

// ПУБЛИКАЦИЯ УРОКОВ И ТЕСТОВ
app.post('/api/admin/upload', (req, res) => {
    const materials = readData('materials.json');
    materials.push({ id: String(Date.now()), ...req.body });
    writeData('materials.json', materials); res.json({ success: true, message: 'Урок опубликован!' });
});

app.get('/api/materials/:class', (req, res) => {
    res.json(readData('materials.json').filter(m => m.class === req.params.class));
});

// НАЧИСЛЕНИЕ МОНЕТ И XP ЗА ТЕСТЫ
app.post('/api/grades/save', (req, res) => {
    const { studentEmail, lessonTitle } = req.body;
    const grades = readData('grades.json'); users = readData('users.json', {});
    grades.push({ ...req.body, date: new Date().toLocaleDateString() });
    
    if (users[studentEmail]) {
        let u = users[studentEmail];
        u.coins = (u.coins || 0) + 15;
        u.xp = (u.xp || 0) + 50;
        if (u.xp >= u.level * 100) {
            u.level += 1;
            if (!u.badges.includes('🧠 Отличник')) u.badges.push('🧠 Отличник');
        }
    }
    writeData('grades.json', grades); writeData('users.json', users);
    res.json({ success: true, user: users[studentEmail] });
});

app.get('/api/grades/:email', (req, res) => res.json(readData('grades.json').filter(g => g.studentEmail === req.params.email)));

// КОЛЕСО ФОРТУНЫ: Сохранение выигрыша в базу данных
app.post('/api/wheel/spin', (req, res) => {
    const { email, winCoins } = req.body; users = readData('users.json', {});
    if (users[email]) {
        users[email].coins = (users[email].coins || 0) + Number(winCoins);
        writeData('users.json', users);
        return res.json({ success: true, coins: users[email].coins });
    }
    res.status(400).json({ success: false });
});

// ДОМАШНИЕ ЗАДАНИЯ
app.post('/api/hw/submit', (req, res) => {
    const hw = readData('hw.json'); hw.push({ id: String(Date.now()), ...req.body, status: 'На проверке', grade: '', review: '' });
    writeData('hw.json', hw); res.json({ success: true, message: 'ДЗ отправлено!' });
});

app.get('/api/hw/student/:email', (req, res) => res.json(readData('hw.json').filter(h => h.studentEmail === req.params.email)));

app.post('/api/hw/review', (req, res) => {
    const { id, grade, review } = req.body; let hw = readData('hw.json'); users = readData('users.json', {});
    const item = hw.find(h => h.id === id);
    if (item) {
        item.status = 'Проверено'; item.grade = grade; item.review = review;
        if (users[item.studentEmail]) {
            users[item.studentEmail].xp = (users[item.studentEmail].xp || 0) + 100;
            if (grade === '5') {
                users[item.studentEmail].coins = (users[item.studentEmail].coins || 0) + 30;
                if (!users[item.studentEmail].badges.includes('🏆 Перфекционист')) users[item.studentEmail].badges.push('🏆 Перфекционист');
            }
        }
        writeData('hw.json', hw); writeData('users.json', users);
    }
    res.json({ success: true });
});

// МАГАЗИН НАГРАД
app.post('/api/shop/buy', (req, res) => {
    const { email, itemTitle, price } = req.body; users = readData('users.json', {});
    if (!users[email] || (users[email].coins || 0) < price) return res.status(400).json({ success: false, message: 'Нехватка монет' });
    users[email].coins -= price;
    const orders = readData('orders.json'); orders.push({ email, itemTitle, date: new Date().toLocaleDateString() });
    writeData('users.json', users); writeData('orders.json', orders);
    res.json({ success: true, message: 'Покупка успешна!', coins: users[email].coins });
});

// ЗАПИСЬ НА УРОКИ
app.post('/api/appointments/book', (req, res) => {
    const appointments = readData('appointments.json'); appointments.push(req.body);
    writeData('appointments.json', appointments); res.json({ success: true });
});

// СУПЕР-ДАШБОРД АНАЛИТИКИ
app.get('/api/dashboard/:role/:email', (req, res) => {
    users = readData('users.json', {});
    const { role, email } = req.params;
    const uList = Object.keys(users).map(e => ({ email: e, ...users[e] }));
    const appointments = readData('appointments.json');
    const hw = readData('hw.json');
    
    res.json({
        students: uList.filter(u => u.role === 'student'),
        teachers: uList.filter(u => u.role === 'teacher'),
        appointments: appointments,
        homeworks: role === 'admin' ? hw : hw.filter(h => h.teacherEmail === email),
        grades: readData('grades.json'),
        orders: readData('orders.json')
    });
});

// ЧАТЫ И КОММЕНТАРИИ
app.post('/api/comments/add', (req, res) => {
    const c = readData('comments.json'); c.push({ ...req.body, date: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) });
    writeData('comments.json', c); res.json({ success: true });
});
app.get('/api/comments/:lessonId', (req, res) => res.json(readData('comments.json').filter(c => String(c.lessonId) === String(req.params.lessonId))));

// СОВМЕСТНАЯ ДОСКА
app.post('/api/board/save', (req, res) => { writeData('board.json', { image: req.body.boardData }); res.json({ success: true }); });
app.get('/api/board/load', (req, res) => { res.json(readData('board.json', { image: '' })); });

app.listen(PORT, () => console.log('Академия Будущего запущена!'));



