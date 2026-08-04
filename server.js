const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Функции для работы с файлами-базами данных
const readData = (filename, defaultData = []) => {
    try {
        if (!fs.existsSync(filename)) return defaultData;
        const content = fs.readFileSync(filename, 'utf8');
        return JSON.parse(content);
    } catch (e) {
        return defaultData;
    }
};

const writeData = (filename, data) => {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf8');
};

// Инициализация дефолтного админа
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

// Регистрация ученика
app.post('/api/register', (req, res) => {
    const { email, password, name, schoolClass } = req.body;
    users = readData('users.json', {});
    if (users[email]) {
        return res.status(400).json({ success: false, message: 'Этот Email уже занят' });
    }
    users[email] = { password, name, role: 'student', class: schoolClass };
    writeData('users.json', users);
    res.json({ success: true, message: 'Ученик успешно зарегистрирован!' });
});

// АДМИН: Загрузка нового материала
app.post('/api/admin/upload', (req, res) => {
    const { schoolClass, title, content } = req.body;
    const materials = readData('materials.json');
    materials.push({ class: schoolClass, title, content });
    writeData('materials.json', materials);
    res.json({ success: true, message: 'Материал успешно загружен для учеников!' });
});

// Получение материалов для конкретного класса
app.get('/api/materials/:class', (req, res) => {
    const materials = readData('materials.json');
    const filtered = materials.filter(m => m.class === req.params.class);
    res.json(filtered);
});

// Запись на урок к преподавателю
app.post('/api/appointments/book', (req, res) => {
    const { studentEmail, teacherName, lessonTime } = req.body;
    const appointments = readData('appointments.json');
    appointments.push({ student_email: studentEmail, teacher_name: teacherName, lesson_time: lessonTime });
    writeData('appointments.json', appointments);
    res.json({ success: true, message: 'Вы успешно записались на урок!' });
});

// АДМИН: Посмотреть всех учеников и все записи
app.get('/api/admin/dashboard', (req, res) => {
    users = readData('users.json', {});
    const appointments = readData('appointments.json');
    
    const studentsList = Object.keys(users)
        .filter(email => users[email].role === 'student')
        .map(email => ({ email, name: users[email].name, class: users[email].class }));

    const appsList = appointments.map(a => {
        const student = users[a.student_email] || { name: 'Удаленный ученик' };
        return { student_name: student.name, teacher_name: a.teacher_name, lesson_time: a.lesson_time };
    });

    res.json({ students: studentsList, appointments: appsList });
});

app.listen(PORT, () => console.log(`Полноценная школа запущена в облаке!`));

