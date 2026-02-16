# FitTrack Pro - Advanced Fitness & Productivity Dashboard

**FitTrack Pro** is a modern, comprehensive full-stack web application that combines task management, nutrition tracking, workout logging, and gamification features. Built with a professional design system using Python Flask backend and vanilla JavaScript frontend.

## ✨ What's New in This Version

- **Modern Sidebar Navigation** - Sleek, intuitive navigation with 8 dedicated pages
- **Gamification Features** - Streak tracking, points system, and achievements
- **Advanced Task Management** - Create, organize, and track tasks with detailed subtasks and notes
- **Project Tracking** - Monitor long-term fitness and productivity goals
- **Calendar View** - Visual calendar for scheduling and tracking
- **Professional Design** - Modern UI with gradients, animations, and responsive layout
- **Real-time Data** - Instant updates and live calculation of metrics

## 🎯 Key Features

### 📊 Dashboard
- **Welcome Section** - Personalized greeting with goal overview
- **Metrics Cards** - Today's time, weekly workouts, goals completed, calories burned
- **Coming Up Activities** - Next scheduled tasks and workouts
- **Progress Tracking** - Visual progress bars for goals and achievements
- **Quick Actions** - Fast access to common tasks (Start Timer, Log Workout, Set New Goal)

### 🔥 Streaks & Points System
- **Current Streak Display** - Track consecutive days of activity
- **Point System** - Earn points and level up
- **Achievements** - Unlock badges (Week Warrior, Workout Master, Nutrition Expert, Goal Crusher)
- **Leaderboard-style Stats** - Compare your performance

### ✅ My Tasks
- **Add Tasks** - Create new tasks with title and priority
- **Task Organization** - Separate views for Active Tasks and Completed Tasks
- **Priority Levels** - Low, Medium, High priority actions
- **Subtasks** - Break down tasks into smaller actionable steps
- **Task Notes** - Add detailed notes and instructions
- **Task Details Expandable** - Click to reveal more information
- **Completion Tracking** - Visual feedback for completed tasks

### 🏗️ Projects
- **Summer Fitness Challenge** - Track 20 workouts over summer
- **Nutrition Overhaul** - 30-day meal tracking project
- **Weight Loss Goal** - Monitor progress toward target weight
- **Progress Visualization** - See completion percentage at a glance
- **Project Timelines** - Set and monitor deadlines

### 💪 Workout Log
- **Recent Workouts** - List of latest sessions with duration and calories
- **Weekly Summary** - Bar chart showing workout minutes per day
- **Workout Types** - Track Cardio, Strength, Flexibility, and Sports
- **Calories Burned** - Monitor energy expenditure
- **Performance Tracking** - Visual trends in workout consistency

### 🍎 Nutrition
- **Today's Meals** - Display of all meals logged
- **Meal Details** - Time, description, and calories per meal
- **Macro Tracking** - Monitor Protein, Carbs, and Fats
- **Calorie Goals** - Visual progress toward daily calorie target
- **Meal Types** - Breakfast, Snack, Lunch, Pre-Workout, Post-Workout

### 📈 Statistics
- **Average Daily Steps** - Track movement
- **Workouts Per Week** - Consistency metrics
- **Average Calories Burned** - Energy expenditure trends
- **Goal Completion Rate** - Overall progress percentage
- **Weight Progress Chart** - Visual weight loss/gain trend
- **Historical Data** - Track progress over time

### 📅 Calendar
- **Monthly View** - Visual calendar layout
- **Event Scheduling** - Schedule upcoming workouts and tasks
- **Daily Highlights** - Color-coded days for activity levels

## 🛠️ Tech Stack

### Backend
- **Python 3.x** - Programming language
- **Flask** - Lightweight web framework
- **Flask-CORS** - Cross-Origin Resource Sharing
- **JSON** - Data persistence

### Frontend
- **HTML5** - Modern semantic markup
- **CSS3** - Advanced styling with Grid, Flexbox, and Gradients
- **Vanilla JavaScript (ES6+)** - Interactive functionality
- **Font Awesome 6** - Professional iconography
- **Google Fonts** - Inter typeface for clean aesthetics

## 📁 Project Structure

```
FitTrack-Pro/
├── app.py                      # Flask application with API endpoints
├── fitness_data.json          # Data storage (auto-created)
├── requirements.txt            # Python dependencies
├── README.md                  # This file
└── static/
    ├── index.html             # Main HTML with sidebar + pages
    ├── styles.css             # Complete styling (1172 lines)
    ├── script.js              # Frontend logic and interactivity
    └── index2.html            # Alternative prototype version
```

## 🚀 Installation & Quick Start

### Prerequisites
- Python 3.7+
- pip (Python package manager)

### Step 1: Install Dependencies

```bash
pip install Flask Flask-CORS
```

Or use requirements.txt:
```bash
pip install -r requirements.txt
```

### Step 2: Run the Server

```bash
python app.py
```

### Step 3: Open in Browser

Navigate to `http://localhost:5000`

## 📖 Usage Guide

### Navigation
- Use the **Sidebar** on the left to navigate between pages
- Each page has its own dedicated view and functionality
- The active page is highlighted in the navigation

### Dashboard
- **Home page** with overview of all activity
- Update metrics are calculated from your logged data
- Quick actions provide fast access to main features

### Managing Tasks
1. Click **"My Tasks"** in the sidebar
2. Click **"+ Add Task"** button
3. Enter task title and select priority
4. Click **"Create Task"**
5. Tasks appear in Active or Completed sections
6. Click task to expand and see details
7. Check checkbox to mark complete

### Logging Workouts
1. Navigate to **"Workout Log"**
2. View recent workouts with duration and calories
3. Use the API to add new workouts (via backend)
4. Track weekly progress in the chart

### Tracking Nutrition
1. Go to **"Nutrition"** page
2. View today's meals with calorie counts
3. See overall macro breakdown (Protein, Carbs, Fats)
4. Monitor progress toward daily goals

### Viewing Streaks & Achievements
1. Click **"Streaks & Points"** in sidebar
2. See your current streak and points earned
3. Check level and points to next level
4. View completed achievements

### Managing Projects
1. Select **"Projects"** from navigation
2. View long-term fitness and productivity projects
3. Track progress with visual progress bars
4. Monitor project timelines

### Checking Statistics
1. Go to **"Statistics"** page
2. Review key performance indicators
3. View weight progress chart
4. See historical trends

## 🔌 API Endpoints

### Tasks Management
```
GET    /api/tasks              - Get all tasks
POST   /api/tasks              - Create new task
GET    /api/tasks?date=YYYY-MM-DD
PUT    /api/tasks/{id}         - Update task
DELETE /api/tasks/{id}         - Delete task
PATCH  /api/tasks/{id}/toggle  - Toggle completion
```

### Workout Tracking
```
GET    /api/workouts           - Get all workouts
POST   /api/workouts           - Log new workout
GET    /api/workouts?date=YYYY-MM-DD
PUT    /api/workouts/{id}      - Update workout
DELETE /api/workouts/{id}      - Delete workout
```

### Nutrition Logging
```
GET    /api/meals              - Get all meals
POST   /api/meals              - Log new meal
GET    /api/meals?date=YYYY-MM-DD
PUT    /api/meals/{id}         - Update meal
DELETE /api/meals/{id}         - Delete meal
```

### Analytics
```
GET /api/analytics/summary     - Daily summary with date filter
GET /api/analytics/weekly      - Last 7 days statistics
GET /api/data                  - Dashboard data summary
```

## 🎨 Customization

### Change Theme Colors
Edit `static/styles.css` and modify these variable values:
```css
:root {
    --primary-blue: #2563eb;
    --primary-green: #16a34a;
    --primary-orange: #f59e0b;
    --primary-purple: #a855f7;
}
```

### Add New Features
All JavaScript functionality is in `static/script.js`. Add new functions for:
- Custom notifications
- Advanced filtering
- Data export
- Import from external sources

### Modify Content
Update the HTML in `static/index.html` to:
- Change goal amounts
- Modify achievement names
- Adjust metric displays
- Add new sections

## 📱 Responsive Design

The application is fully responsive and works on:
- **Desktop** - Full sidebar + content layout
- **Tablet** - Optimized spacing and touch targets
- **Mobile** - Adapted navigation for smaller screens

### Add to Home Screen

**iOS:**
1. Open Safari
2. Tap Share → Add to Home Screen

**Android:**
1. Open Chrome
2. Menu (3 dots) → Add to Home Screen

## 💾 Data Management

- **Auto-saved** to `fitness_data.json`
- **Local storage** - No external databases required
- **Easy backup** - Copy the JSON file
- **Portable** - Move between devices easily
- **Single-user** - Private, personal data

## 🎯 Getting the Most Out of FitTrack

### Best Practices
1. **Log consistently** - Daily entry for tracking accuracy
2. **Use priorities** - Mark tasks by importance
3. **Set realistic goals** - Achievable targets boost motivation
4. **Review streaks** - Check your progress regularly
5. **Track metrics** - Monitor calories and workout time
6. **Create projects** - Break goals into manageable chunks

### Tips & Tricks
- Use subtasks to break down complex projects
- Add notes for additional context
- Check calendar for upcoming events
- Review statistics weekly for trends
- Update goals monthly

## 🔒 Privacy & Security

- **100% Local** - Data stored locally on your device
- **No Cloud Sync** - Maximum privacy
- **No Tracking** - No telemetry or analytics
- **No Authentication** - Direct access (single-user)
- **Your Data, Your Control** - Export anytime

## 🚀 Future Enhancements

Planned features:
- Database integration (SQLite/PostgreSQL)
- Multi-user support with authentication
- Meal plans and recipes database
- Workout templates and programs
- Body measurements tracking
- Sleep and hydration logging
- Photo progress gallery
- Data export (CSV, PDF)
- Dark mode
- Mobile app (React Native)
- Cloud sync option
- Social features (community)

## 🐛 Troubleshooting

### Application won't start
```bash
# Check Python version
python --version

# Try running with explicit path
python3 app.py
```

### Port 5000 already in use
Edit `app.py` and change port:
```python
app.run(debug=True, host='0.0.0.0', port=5001)
```

### Styles not loading
- Clear browser cache (Ctrl+F5 or Cmd+Shift+R)
- Check that `static/styles.css` exists
- Verify file permissions

### Data not persisting
- Check write permissions in directory
- Ensure `fitness_data.json` is not read-only
- Check disk space availability

## 📄 License

Open source, available for personal and educational use.

## 🤝 Contributing

Feel free to:
- Fork and customize
- Add new features
- Improve the design
- Enhance functionality
- Share improvements

## 🎉 Enjoy!

---

**Track your progress, build better habits, and achieve your goals with FitTrack Pro!**

Made with ❤️ for fitness enthusiasts and productivity champions.
