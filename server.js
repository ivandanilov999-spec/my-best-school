const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Чтение и запись файлов базы данных
const readData = (filename, defaultData = []) => {
    try {
        if (!fs.existsSync(filename)) return defaultData;
        const content = fs.readFileSync(filename, 'utf8');
        return JSON.parse(content);
    } catch (e) { return defaultData; }
};

const writeData = (filename, data) => {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf8');
};

// Инициализация администратора
let users = readData('users.json', {});
if (!users['admin@school.com']) {
    users['admin@school.com'] = { password: 'admin777', name: 'Директор', role: 'admin', class: 'all' };
    writeData('users.json', users);
}

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Авторизация
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    users = readData('users.json', {});
    const user = users[email];
    if (!user || user.password !== password) {
        return res.status(400).json({ success: false, message: 'Неверный email или пароль' });
    }
    res.json({ success: true, role: user.role, user: { email, name: user.name, class: user.class } });
});

// Регистрация
app.post('/api/register', (req, res) => {
    const { email, password, name, schoolClass } = req.body;
    users = readData('users.json', {});
    if (users[email]) return res.status(400).json({ success: false, message: 'Этот Email уже занят' });
    users[email] = { password, name, role: 'student', class: schoolClass };
    writeData('users.json', users);
    res.json({ success: true, message: 'Ученик успешно зарегистрирован!' });
});

// АДМИН: Загрузка урока с видео и тестом
app.post('/api/admin/upload', (req, res) => {
    const { schoolClass, title, content, videoUrl, testQuestion, testAnswer } = req.body;
    const materials = readData('materials.json');
    materials.push({
        id: Date.now(),
        class: schoolClass,
        title,
        content,
        videoUrl: videoUrl || '',
        testQuestion: testQuestion || '',
        testAnswer: testAnswer || ''
    });
    writeData('materials.json', materials);
    res.json({ success: true, message: 'Крутой интерактивный урок успешно опубликован!' });
});

// Получение уроков для класса
app.get('/api/materials/:class', (req, res) => {
    const materials = readData('materials.json');
    const filtered = materials.filter(m => m.class === req.params.class);
    res.json(filtered);
});

// Запись на урок
app.post('/api/appointments/book', (req, res) => {
    const { studentEmail, teacherName, lessonTime } = req.body;
    const appointments = readData('appointments.json');
    appointments.push({ student_email: studentEmail, teacher_name: teacherName, lesson_time: lessonTime });
    writeData('appointments.json', appointments);
    res.json({ success: true, message: 'Вы успешно записались на урок!' });
});

// Сохранение оценки за тест
app.post('/api/grades/save', (req, res) => {
    const { studentEmail, lessonTitle, score } = req.body;
    const grades = readData('grades.json');
    grades.push({ studentEmail, lessonTitle, score, date: new Date().toLocaleDateString() });
    writeData('grades.json', grades);
    res.json({ success: true, message: 'Оценка сохранена в журнал!' });
});

// Получение оценок конкретного ученика
app.get('/api/grades/:email', (req, res) => {
    const grades = readData('grades.json');
    const filtered = grades.filter(g => g.studentEmail === req.params.email);
    res.json(filtered);
});

// ЧАТ: Отправка вопроса/комментария
app.post('/api/comments/add', (req, res) => {
    const { lessonId, userName, text } = req.body;
    const comments = readData('comments.json');
    comments.push({ lessonId, userName, text, date: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
    writeData('comments.json', comments);
    res.json({ success: true });
});

// ЧАТ: Получение комментариев для урока
app.get('/api/comments/:lessonId', (req, res) => {
    const comments = readData('comments.json');
    const filtered = comments.filter(c => String(c.lessonId) === String(req.params.lessonId));
    res.json(filtered);
});

// АДМИН: Дашборд (Ученики, Записи, Журнал оценок)
app.get('/api/admin/dashboard', (req, res) => {
    users = readData('users.json', {});
    const appointments = readData('appointments.json');
    const grades = readData('grades.json');
    
    const studentsList = Object.keys(users)
        .filter(email => users[email].role === 'student')
        .map(email => ({ email, name: users[email].name, class: users[email].class }));

    const appsList = appointments.map(a => {
        const student = users[a.student_email] || { name: 'Ученик' };
        return { student_name: student.name, teacher_name: a.teacher_name, lesson_time: a.lesson_time };
    });

    const gradesList = grades.map(g => {
        const student = users[g.studentEmail] || { name: g.studentEmail };
        return { student_name: student.name, lesson_title: g.lessonTitle, score: g.score, date: g.date };
    });

    res.json({ students: studentsList, appointments: appsList, grades: gradesList });
});

app.listen(PORT, () => console.log(`Школа запущена в облаке со всеми фичами!`));
