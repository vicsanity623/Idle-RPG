import os
import time
import json
import unittest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

class TestMainJS(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """
        Creates a temporary HTML testbed, injects DOM mocks, and loads main.js.
        Then, initializes a Headless Chrome Browser to run the E2E tests.
        """
        # Determine paths (Assumes test_main.py is in tests/ and main.js is in root)
        current_dir = os.path.dirname(os.path.abspath(__file__))
        cls.root_dir = os.path.dirname(current_dir)
        cls.main_js_path = os.path.join(cls.root_dir, 'main.js')
        cls.test_html_path = os.path.join(cls.root_dir, 'test_runner.html')

        # Fallback to current directory if main.js is in the same folder
        if not os.path.exists(cls.main_js_path):
            cls.main_js_path = os.path.join(current_dir, 'main.js')
            cls.test_html_path = os.path.join(current_dir, 'test_runner.html')

        # HTML Scaffolding with necessary DOM Elements and Mock Classes
        html_content = """
        <!DOCTYPE html>
        <html>
        <head><title>Game Engine Test</title></head>
        <body>
            <!-- Canvas -->
            <canvas id="game-canvas"></canvas>
            <canvas id="minimap"></canvas>
            
            <!-- UI Elements -->
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

            <!-- Mocks for Missing Objects in main.js -->
            <script>
                class Player { constructor(x,y){this.x=x;this.y=y;this.hp=100;} getMaxHp(){return 100;} getAttackPower(){return 10;} getDefense(){return 10;} getRegen(){return 1;} getCritChance(){return 1;} getCritMultiplier(){return 1;} }
                class Enemy { constructor(x,y){this.x=x;this.y=y;} update(){} draw(){} }
                class Loot { constructor(x,y,t){this.x=x;this.y=y;this.type=t;} update(){} draw(){} }
                class Particle { constructor(x,y,c){this.x=x;this.y=y;this.c=c;} update(){} draw(){} }
                class FloatingText { constructor(x,y,t,c){this.x=x;this.y=y;} update(){} draw(){} }
                const HiveMind = { update: () => {} };
            </script>

            <!-- Load user script -->
            <script src="main.js"></script>
        </body>
        </html>
        """
        
        # Write temporary HTML runner
        with open(cls.test_html_path, "w") as f:
            f.write(html_content)

        # Setup Headless Chrome
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        
        cls.driver = webdriver.Chrome(options=chrome_options)
        
        # Load the HTML file via File URI
        file_uri = f"file://{cls.test_html_path}"
        cls.driver.get(file_uri)
        
        # Clear Local Storage before tests start
        cls.driver.execute_script("localStorage.clear();")

        # Emulate waiting for the "Boot" sequence to finish
        time.sleep(1.0) 
        
        # Click Play to trigger `initLevel()` and change state to 'PLAYING'
        cls.driver.execute_script("document.getElementById('play-btn').click();")
        time.sleep(0.5)

    @classmethod
    def tearDownClass(cls):
        """Clean up the browser and temporary files after tests."""
        cls.driver.quit()
        if os.path.exists(cls.test_html_path):
            os.remove(cls.test_html_path)

    def get_game_state_level(self):
        return self.driver.execute_script("return GameState.level;")

    def get_local_storage_save(self):
        data = self.driver.execute_script("return localStorage.getItem('dof_save');")
        return json.loads(data) if data else {}

    def test_01_initialization(self):
        """Test that the game initializes at level 1."""
        level = self.get_game_state_level()
        self.assertEqual(level, 1, "Game should initialize at Depth Level 1")

    def test_02_level_up_saves_depth(self):
        """Test that pendingLevelUp triggers a level increment and saves to localStorage."""
        # Trigger the portal level up flag
        self.driver.execute_script("levelUpDungeon();")
        
        # Wait a brief moment for the game loop `requestAnimationFrame` to process it
        time.sleep(0.5)
        
        # 1. Check GameState Engine Level
        level = self.get_game_state_level()
        self.assertEqual(level, 2, "GameState.level should increment to 2")
        
        # 2. Check Persistent Storage
        save_data = self.get_local_storage_save()
        self.assertEqual(save_data.get('dungeonLevel'), 2, "dungeonLevel 2 should be saved in localStorage")

    def test_03_death_resets_depth(self):
        """Test that dying immediately resets the depth back to 1 and overwrites the save."""
        self.driver.execute_script("die();")
        
        # 1. Verify level drops to 1
        level = self.get_game_state_level()
        self.assertEqual(level, 1, "Death should instantly reset GameState.level to 1")
        
        # 2. Verify localStorage overwritten with depth 1
        save_data = self.get_local_storage_save()
        self.assertEqual(save_data.get('dungeonLevel'), 1, "dungeonLevel 1 should be saved to localStorage upon death")

    def test_04_load_game_restores_depth(self):
        """Test that returning to the game and calling loadGame() restores a high-level depth."""
        # Simulate an old save where the player was at Depth 5
        fake_save = {"dungeonLevel": 5, "gold": 100, "shards": 50}
        self.driver.execute_script(f"localStorage.setItem('dof_save', JSON.stringify({json.dumps(fake_save)}));")
        
        # Run the load game script
        self.driver.execute_script("loadGame();")
        
        level = self.get_game_state_level()
        self.assertEqual(level, 5, "loadGame() should sync GameState.level to match PlayerData.dungeonLevel")

if __name__ == "__main__":
    unittest.main()
