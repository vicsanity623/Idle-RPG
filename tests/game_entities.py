class GameEntity:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def update(self):
        pass

    def draw(self):
        pass

class Player(GameEntity):
    def __init__(self, x, y):
        super().__init__(x, y)
        self.hp = 100

    def get_max_hp(self):
        return 100

    def get_attack_power(self):
        return 10

    def get_defense(self):
        return 10

    def get_regen(self):
        return 1

    def get_crit_chance(self):
        return 1

    def get_crit_multiplier(self):
        return 1

class Enemy(GameEntity):
    def __init__(self, x, y):
        super().__init__(x, y)

class Loot(GameEntity):
    def __init__(self, x, y, type):
        super().__init__(x, y)
        self.type = type

class Particle(GameEntity):
    def __init__(self, x, y, c):
        super().__init__(x, y)
        self.c = c

class FloatingText(GameEntity):
    def __init__(self, x, y, t, c):
        super().__init__(x, y)
        self.t = t
        self.c = c