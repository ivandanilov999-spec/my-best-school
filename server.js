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

let users = readData('users.json', {});
if (!users['admin@school.com']) {
    users['admin@school.com'] = { password: 'admin777', name: 'Директор', role: 'admin', class: 'all', coins: 0 };
    writeData('users.json', users);
}

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/login', (req, res) => {
    const { email, password } = req.body; users = readData('users.json', {});
    const u = users[email];
    if (!u || u.password !== password) return res.status(400).json({ success: false, message: 'Неверные данные' });
    res.json({ success: true, role: u.role, user: { email, name: u.name, class: u.class, coins: u.coins || 0 } });
});

app.post('/api/register', (req, res) => {
    const { email, password, name, schoolClass, role } = req.body; users = readData('users.json', {});
    if (users[email]) return res.status(400).json({ success: false, message: 'Email занят' });
    users[email] = { password, name, role: role || 'student', class: schoolClass, coins: 0 };
    writeData('users.json', users); res.json({ success: true, message: 'Успешно!' });
});

app.post('/api/admin/upload', (req, res) => {
    const materials = readData('materials.json');
    materials.push({ id: String(Date.now()), ...req.body });
    writeData('materials.json', materials); res.json({ success: true, message: 'Урок создан!' });
});

app.get('/api/materials/:class', (req, res) => {
    res.json(readData('materials.json').filter(m => m.class === req.params.class));
});

app.post('/api/appointments/book', (req, res) => {
    const app = readData('appointments.json'); app.push(req.body);
    writeData('appointments.json', app); res.json({ success: true, message: 'Запись создана!' });
});

// МОНЕТЫ И ТЕСТЫ
app.post('/api/grades/save', (req, res) => {
    const { studentEmail, lessonTitle } = req.body;
    const grades = readData('grades.json'); users = readData('users.json', {});
    grades.push({ ...req.body, date: new Date().toLocaleDateString() });
    if (users[studentEmail]) users[studentEmail].coins = (users[studentEmail].coins || 0) + 10; // +10 монет за тест
    writeData('grades.json', grades); writeData('users.json', users);
    res.json({ success: true, coins: users[studentEmail].coins });
});

app.get('/api/grades/:email', (req, res) => res.json(readData('grades.json').filter(g => g.studentEmail === req.params.email)));

// ДОМАШНИЕ ЗАДАНИЯ (ДЗ)
app.post('/api/hw/submit', (req, res) => {
    const hw = readData('hw.json'); hw.push({ id: String(Date.now()), ...req.body, status: 'На проверке', grade: '', review: '' });
    writeData('hw.json', hw); res.json({ success: true, message: 'ДЗ отправлено учителю!' });
});

app.get('/api/hw/student/:email', (req, res) => res.json(readData('hw.json').filter(h => h.studentEmail === req.params.email)));

app.post('/api/hw/review', (req, res) => {
    const { id, grade, review } = req.body; let hw = readData('hw.json'); users = readData('users.json', {});
    const item = hw.find(h => h.id === id);
    if (item) {
        item.status = 'Проверено'; item.grade = grade; item.review = review;
        if (grade === '5' && users[item.studentEmail]) users[item.studentEmail].coins = (users[item.studentEmail].coins || 0) + 20; // +20 монет за ДЗ на "5"
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

// ДАШБОРДЫ ДЛЯ УЧИТЕЛЯ И АДМИНА
app.get('/api/dashboard/:role/:email', (req, res) => {
    users = readData('users.json', {});
    const { role, email } = req.params;
    const uList = Object.keys(users).map(e => ({ email: e, ...users[e] }));
    const appointments = readData('appointments.json');
    const hw = readData('hw.json');
    
    // Фильтрация: Учитель видит только свои записи и ДЗ по своему имени
    const apps = role === 'admin' ? appointments : appointments.filter(a => a.teacher_email === email || a.teacherName.includes(users[email]?.name));
    const homeworks = role === 'admin' ? hw : hw.filter(h => h.teacherEmail === email);

    res.json({
        students: uList.filter(u => u.role === 'student'),
        teachers: uList.filter(u => u.role === 'teacher'),
        appointments: apps,
        homeworks: homeworks,
        grades: readData('grades.json'),
        orders: readData('orders.json')
    });
});

app.post('/api/comments/add', (req, res) => {
    const c = readData('comments.json'); c.push({ ...req.body, date: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) });
    writeData('comments.json', c); res.json({ success: true });
});
app.get('/api/comments/:lessonId', (req, res) => res.json(readData('comments.json').filter(c => String(c.lessonId) === String(req.params.lessonId))));

app.listen(PORT, () => console.log('Академия запущена!'));
