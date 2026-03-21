#!/bin/bash

echo "🚀 Running Idle-RPG Validation on GitHub Actions..."

# 1. Install dependencies
echo "📦 Installing testing dependencies..."
python3 -m pip install --upgrade pip --quiet
python3 -m pip install pytest selenium --quiet

# 2. Automatically generate the test file
echo "🔧 Setting up headless testing environment..."
mkdir -p tests
cat << 'EOF' > tests/test_main.py
import os
import time
import json
import unittest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

class TestMainJS(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        cls.root_dir = os.path.dirname(current_dir)
        cls.main_js_path = os.path.join(cls.root_dir, 'main.js')
        cls.test_html_path = os.path.join(cls.root_dir, 'test_runner.html')

        if not os.path.exists(cls.main_js_path):
            cls.main_js_path = os.path.join(current_dir, 'main.js')
            cls.test_html_path = os.path.join(current_dir, 'test_runner.html')

        html_content = """
        <!DOCTYPE html>
        <html>
        <head><title>Game Engine Test</title></head>
        <body>
            <canvas id="game-canvas"></canvas>
            <canvas id="minimap"></canvas>
            <div id="joystick-zone"></div>
            <div id="j-base"><div id="j-stick"></div></div>
            <div id="p-level"></div><div id="hp-fill"></div><div id="hp-text"></div>
            <div id="xp-fill"></div><div id="xp-text"></div>
            <div id="c-gold"></div><div id="c-shard"></div>
            <div id="inventory-modal" style="display:none"></div>
            <div id="stats-sheet"></div><div id="gear-grid"></div>
            <div id="notification"></div>
            <div id="daily-login" style="display:none"></div>
            <div id="d-level"></div>
            <div id="loading-fill"></div><div id="loading-screen"></div>
            <div id="main-menu" class="hidden"></div>
            <button id="play-btn">Play</button>
            <div id="ui-layer" class="hidden"></div>

            <script>
                class Player { constructor(x,y){this.x=x;this.y=y;this.hp=100;} getMaxHp(){return 100;} getAttackPower(){return 10;} getDefense(){return 10;} getRegen(){return 1;} getCritChance(){return 1;} getCritMultiplier(){return 1;} }
                class Enemy { constructor(x,y){this.x=x;this.y=y;} update(){} draw(){} }
                class Loot { constructor(x,y,t){this.x=x;this.y=y;this.type=t;} update(){} draw(){} }
                class Particle { constructor(x,y,c){this.x=x;this.y=y;this.c=c;} update(){} draw(){} }
                class FloatingText { constructor(x,y,t,c){this.x=x;this.y=y;} update(){} draw(){} }
                const HiveMind = { update: () => {} };
            </script>
            <script src="main.js"></script>
        </body>
        </html>
        """
        
        with open(cls.test_html_path, "w") as f:
            f.write(html_content)

        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        
        cls.driver = webdriver.Chrome(options=chrome_options)
        file_uri = f"file://{cls.test_html_path}"
        cls.driver.get(file_uri)
        cls.driver.execute_script("localStorage.clear();")

        # Wait for boot animation to finish
        time.sleep(2.5) 
        cls.driver.execute_script("document.getElementById('play-btn').click();")
        time.sleep(0.5)

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()
        if os.path.exists(cls.test_html_path):
            os.remove(cls.test_html_path)

    def get_game_state_level(self):
        return self.driver.execute_script("return GameState.level;")

    def get_local_storage_save(self):
        data = self.driver.execute_script("return localStorage.getItem('dof_save');")
        return json.loads(data) if data else {}

    def test_01_initialization(self):
        level = self.get_game_state_level()
        self.assertEqual(level, 1, "Game should initialize at Depth Level 1")

    def test_02_death_resets_depth(self):
        self.driver.execute_script("die();")
        level = self.get_game_state_level()
        self.assertEqual(level, 1, "Death should instantly reset GameState.level to 1")
        
        save_data = self.get_local_storage_save()
        self.assertEqual(save_data.get('dungeonLevel'), 1, "dungeonLevel 1 should be saved to localStorage upon death")

    def test_03_load_game_restores_depth(self):
        fake_save = {"dungeonLevel": 5, "gold": 100, "shards": 50}
        self.driver.execute_script(f"localStorage.setItem('dof_save', JSON.stringify({json.dumps(fake_save)}));")
        self.driver.execute_script("loadGame();")
        level = self.get_game_state_level()
        self.assertEqual(level, 5, "loadGame() should sync GameState.level to match PlayerData.dungeonLevel")

if __name__ == "__main__":
    unittest.main()
EOF

# 3. Run the test suite and capture the exit code
echo "🧪 Running E2E tests for main.js..."
python3 -m pytest tests/test_main.py -v
TEST_EXIT_CODE=$?

# 4. Evaluate the result
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All checks passed! The save systems load successfully."
    exit 0
else
    echo "❌ Tests failed! Please review the logs above."
    exit 1
fi
