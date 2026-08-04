const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;

// Подключение к файлу базы данных SQLite
const db = new sqlite3.Database('./school.db', (err) => {
    if (err) console.error('Ошибка подключения к БД:', err.message);
    else console.log('База данных успешно подключена.');
});

// Создание таблиц при первом запуске
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY,
        password TEXT,
        name TEXT,
        role TEXT,
        class TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class TEXT,
        title TEXT,
        content TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_email TEXT,
        teacher_name TEXT,
        lesson_time TEXT
    )`);

    // Создаем тестового админа, если его нет
    db.run(`INSERT OR IGNORE INTO users (email, password, name, role, class) 
            VALUES ('admin@school.com', 'admin777', 'Директор', 'admin', 'all')`);
});

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Авторизация (Исправлено!)
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ? AND password = ?`, [email, password], (err, user) => {
        if (err || !user) {
            return res.status(400).json({ success: false, message: 'Неверный email или пароль' });
        }
        res.json({ success: true, role: user.role, user });
    });
});

// Регистрация ученика
app.post('/api/register', (req, res) => {
    const { email, password, name, schoolClass } = req.body;
    db.run(`INSERT INTO users (email, password, name, role, class) VALUES (?, ?, ?, 'student', ?)`,
        [email, password, name, schoolClass], (err) => {
            if (err) return res.status(400).json({ success: false, message: 'Этот Email уже занят' });
            res.json({ success: true, message: 'Ученик успешно зарегистрирован!' });
        });
});

// АДМИН: Загрузка нового материала
app.post('/api/admin/upload', (req, res) => {
    const { schoolClass, title, content } = req.body;
    db.run(`INSERT INTO materials (class, title, content) VALUES (?, ?, ?)`, [schoolClass, title, content], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, message: 'Материал успешно загружен для учеников!' });
    });
});

// Получение материалов для конкретного класса
app.get('/api/materials/:class', (req, res) => {
    db.all(`SELECT * FROM materials WHERE class = ?`, [req.params.class], (err, rows) => {
        res.json(rows || []);
    });
});

// Запись на урок к преподавателю
app.post('/api/appointments/book', (req, res) => {
    const { studentEmail, teacherName, lessonTime } = req.body;
    db.run(`INSERT INTO appointments (student_email, teacher_name, lesson_time) VALUES (?, ?, ?)`,
        [studentEmail, teacherName, lessonTime], (err) => {
            if (err) return res.status(500).json({ success: false });
            res.json({ success: true, message: 'Вы успешно записались на урок!' });
        });
});

// АДМИН: Посмотреть всех учеников и все записи
app.get('/api/admin/dashboard', (req, res) => {
    db.all(`SELECT email, name, class FROM users WHERE role = 'student'`, [], (err, students) => {
        db.all(`SELECT appointments.*, users.name as student_name FROM appointments 
                JOIN users ON appointments.student_email = users.email`, [], (err, apps) => {
            res.json({ students: students || [], appointments: apps || [] });
        });
    });
});

app.listen(PORT, () => console.log(`Полноценная школа запущена на http://localhost:${PORT}`));



