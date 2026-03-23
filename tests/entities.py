class Player:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.hp = 100

    def getMaxHp(self):
        return 100

    def getAttackPower(self):
        return 10

    def getDefense(self):
        return 10

    def getRegen(self):
        return 1

    def getCritChance(self):
        return 1

    def getCritMultiplier(self):
        return 1


class Enemy:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def update(self):
        pass

    def draw(self):
        pass


class Loot:
    def __init__(self, x, y, t):
        self.x = x
        self.y = y
        self.type = t

    def update(self):
        pass

    def draw(self):
        pass


class Particle:
    def __init__(self, x, y, c):
        self.x = x
        self.y = y
        self.c = c

    def update(self):
        pass

    def draw(self):
        pass


class FloatingText:
    def __init__(self, x, y, t, c):
        self.x = x
        self.y = y

    def update(self):
        pass

    def draw(self):
        pass


class HiveMind:
    @staticmethod
    def update():
        pass