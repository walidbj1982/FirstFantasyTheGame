// =====================================================================
//  STORY  —  First Fantasy: the hunt for the Pendant
// =====================================================================
//  Follows the movie: Terry's flashback at the graveyard, the dark forest,
//  Barret vs Rufus, Ryu's fight, the island map, the boat and the jet skis,
//  Kyo Kusanagi on the island, and Sephiroth at the Roman theater.
//
//  Ev.say('hero1', 'text')            a line of dialogue (portrait + voice)
//  Ev.say('hero1', 'text', 'assets/voices/line.mp3')   ...with a clip cut from the movie
//  Ev.say(null, 'text')               narration
//  Ev.scene('forest')                 backdrop: a movie still from CONFIG.scenes, or a 3D stage
//  ${N.hero1}  inserts a character's name, ${P.town1} a place name
// =====================================================================
'use strict';

const STORY = {
  musicFor(mapId) {
    if (mapId.startsWith('dungeon5') || mapId.startsWith('secret')) return 'rift';
    if (mapId.startsWith('dungeon1')) return 'forest';
    if (mapId === 'world') return 'field';
    return null;
  },

  // ---------------------------------------------------------------- prologue
  async intro() {
    await Ev.scene('intro');
    Music.play('title');
    await Ev.say(null, 'Somewhere on the coast, an old family guards a Pendant.');
    await Ev.say(null, 'Whoever holds it holds enough power to destroy the universe.');
    await Ev.say(null, `And ${N.villain1} wants it.`);
    Ev.endScene();
    await Ev.title('PROLOGUE', 'The Graveyard');
    await Ev.scene('graveyard');
    Music.play('sad');
    await Ev.say('hero1', 'Hey, Dad. It\'s been a while.');
    await Ev.say('hero1', 'I still see that night every time I close my eyes...');
    Ev.endScene();
    await Ev.scene('flashback', 'Years ago - the family villa');
    Music.play('forest');
    await Ev.say('father', `${N.hero1}! Get inside, now! They're here for the Pendant!`);
    Ev.sfx('hit'); Ev.shake(20);
    await Ev.say(null, 'Masked men pour over the villa wall. Terry\'s father fights them off alone...');
    Ev.sfx('crit'); Ev.flash();
    await Ev.say(null, '...until a blow sends him crashing into the pool.');
    await Ev.say('villain1', 'The Pendant is mine. Remember this night, child.');
    Ev.sfx('dark');
    await Ev.say(null, 'The thieves vanish into the dark with the Pendant.');
    Ev.endScene();
    await Ev.scene('graveyard');
    await Ev.say('hero1', `I'm getting it back, Dad. And ${N.villain1} is going to pay.`);
    Ev.endScene();
  },

  canEnter(id) {
    if (id === 'secret' && !Ev.has('gate_rift')) return 'An ancient seal glows on the door. It will not open... yet.';
    return null;
  },

  // ---------------------------------------------------------------- map events
  async onEnter(mapId, f) {
    if (mapId === 'town1' && !Ev.has('intro_done')) return this.friends(f);
    if (mapId === 'town1' && Ev.has('boss_done:dungeon1') && !Ev.has('ch1_return')) return this.ch1Return();
    if (mapId === 'dungeon1:0' && !Ev.has('forest_enter')) return this.forest();
    if (mapId === 'town2' && !Ev.has('ch2_start')) return this.ch2Start();
    if (mapId === 'town3' && !Ev.has('ch3_start')) return this.ch3Start();
    if (mapId === 'town4' && !Ev.has('ch4_start')) return this.ch4Start();
    if (mapId === 'dungeon5:0' && !Ev.has('kyo_done')) return this.kyo();
  },

  async friends(f) {
    Ev.flag('intro_done');
    Music.play('town');
    await Ev.say('hero2', `${N.hero1}! Thought we'd find you here.`);
    await Ev.say('hero3', 'Word is out, man. Sephiroth\'s people have been seen all over the coast.');
    await Ev.say('hero1', 'Then he\'s still looking for something. The Pendant\'s power must need more than the Pendant.');
    await Ev.say('hero2', 'We go together. Like always.');
    await Ev.say('hero3', 'Yeah! Nobody messes with the three of us!');
    await Ev.join('hero2');
    await Ev.join('hero3');
    await Ev.say('hero1', `Somebody saw a stranger in the ${P.dungeon1}, east of town. Let's start there.`);
    await Ev.say('hero2', 'At night? In the forest?');
    await Ev.say('hero3', 'Bring a flashlight. And potions. Lots of potions.');
    await Ev.give('potion', 3);
    await Ev.title('CHAPTER 1', 'Into the Dark');
    Ev.setChapter(1); Ev.flag('ch1_start');
  },

  async forest() {
    Ev.flag('forest_enter');
    await Ev.scene('forest');
    await Ev.say('hero3', 'Is this thing recording? ...Okay. Day one. We\'re going in.');
    await Ev.say('hero2', 'Did you hear that?');
    await Ev.say('hero1', 'Keep moving. Stay together. Whatever happens, don\'t stop running.');
    Ev.endScene();
  },

  async ch1Return() {
    Ev.flag('ch1_return');
    await Ev.say('hero1', `The north bridge to ${P.town2} is open again. ${N.villain2} won't be far.`);
    await Ev.gil(300);
  },

  async ch2Start() {
    Ev.flag('ch2_start'); Ev.setChapter(2);
    await Ev.title('CHAPTER 2', 'Barret vs Rufus');
    await Ev.scene('port', P.town2);
    await Ev.say('hero3', `${N.villain2}... I know that name. He took everything from my town.`);
    await Ev.say('hero2', 'The fishermen say men in black suits have taken the hills to the south-west.');
    await Ev.say('hero3', 'Then that\'s where he is. This one\'s mine, guys.');
    await Ev.say('hero1', 'We\'ve got your back.');
    Ev.endScene();
  },

  async ch3Start() {
    Ev.flag('ch3_start'); Ev.setChapter(3);
    await Ev.title('CHAPTER 3', 'The Wandering Fighter');
    await Ev.scene('hills', P.town3);
    await Ev.say(null, 'An old man in the olive groves has a message for Ryu.');
    await Ev.say('hero2', `"Come to the ${P.dungeon3} alone, fighter. Let us see whose fists are stronger."`);
    await Ev.say('hero1', 'Alone? No way.');
    await Ev.say('hero2', 'Not alone. But I fight first.');
    Ev.endScene();
  },

  async ch4Start() {
    Ev.flag('ch4_start'); Ev.setChapter(4);
    await Ev.title('CHAPTER 4', 'The Map');
    await Ev.scene('coast', P.town4);
    await Ev.say('hero1', 'Two of Sephiroth\'s people down. Someone here must know where he\'s keeping the Pendant.');
    await Ev.say('hero3', `Fisherman says a guy with a map hides in the ${P.dungeon4} to the south-west.`);
    await Ev.say('hero2', 'A map of what?');
    await Ev.say('hero1', 'Let\'s go find out.');
    Ev.endScene();
  },

  // ---------------------------------------------------------------- the island
  async boatTrip(f) {
    Ev.flag('jetski_done');
    await Ev.scene('boat');
    Music.play('sea');
    await Ev.say('hero3', 'How far is the island?');
    await Ev.say('hero2', 'I would say 2 km.');
    await Ev.say('hero1', 'What\'s that noise?');
    Ev.sfx('encounter');
    await Ev.say(null, 'Engines roar across the water. Jet skis, coming in fast!');
    Ev.endScene();
    await Ev.battle(['boss_jetskis'], { boss: true, noRun: true, bg: 'sea', scene: 'jetski' });
    await Ev.scene('island', CONFIG.places.island);
    await Ev.say('hero3', 'Land! Finally!');
    await Ev.say('hero1', `The map marks old ruins on the island. A ${P.dungeon5}.`);
    Ev.endScene();
    await Ev.title('CHAPTER 5', 'The Island');
    Ev.setChapter(5);
  },

  async kyo() {
    Ev.flag('kyo_done');
    await Ev.scene('kyo');
    await Ev.say('villain3', 'Turn back. Nobody goes into the theater.');
    await Ev.say('hero2', `...${N.villain3}? Is that you?`);
    await Ev.say('villain3', `${N.hero2}. Of course it's you.`);
    Ev.endScene();
    await Ev.scene('flashback', 'Years ago');
    Music.play('sad');
    await Ev.say(null, 'Two boys train on the beach until sunset, swearing they\'ll be the strongest fighters in the world.');
    await Ev.say('villain3', 'One day we\'ll find out which of us is stronger.');
    await Ev.say('hero2', 'One day. Promise.');
    Ev.endScene();
    await Ev.scene('kyo');
    await Ev.say('hero2', 'Why are you working for Sephiroth?');
    await Ev.say('villain3', 'Show me you\'re stronger, and maybe I\'ll tell you.');
    Ev.endScene();
    await Ev.battle(['boss_kyo'], { boss: true, noRun: true, bg: 'island' });
    await Ev.say('villain3', 'Heh... you got strong.');
    await Ev.say(null, `${N.villain3} turns and runs into the trees before anyone can stop him.`);
    await Ev.say('hero2', `${N.villain3}! ...We'll finish this one day.`);
  },

  // ---------------------------------------------------------------- bosses
  async boss(did, f) {
    const run = {
      dungeon1: () => this.boss1(), dungeon2: () => this.boss2(), dungeon3: () => this.boss3(),
      dungeon4: () => this.boss4(), dungeon5: () => this.boss5(), secret: () => this.bossSecret()
    }[did];
    await run();
    if (Ev.has('boss_done:' + did)) { f.load(f.map.id, f.px, f.py, f.dir); }
  },

  async boss1() {
    await Ev.say('hero3', 'There! Someone\'s standing between the trees!');
    await Ev.say('villain4', '...');
    await Ev.say('hero1', 'Hey! You! Are you with Sephiroth?');
    await Ev.say('villain4', 'You should not be in this forest at night.');
    await Ev.battle(['boss_stranger'], { boss: true, noRun: true, bg: 'woods', scene: 'boss1' });
    Ev.flag('boss_done:dungeon1');
    await Ev.say('villain4', 'Ugh... he said you would come... the man in black... Rufus...');
    await Ev.say('hero3', 'Rufus?!');
    await Ev.say(null, 'The stranger crawls off into the dark.');
    await Ev.say('hero1', `Let's get out of here. The bridge north to ${P.town2} should be repaired by now.`);
    Ev.flag('gate_bridge');
  },

  async boss2() {
    await Ev.say('villain2', 'Well, well. Barret. Still waving that gun around?');
    await Ev.say('hero3', `${N.villain2}! This ends today!`);
    await Ev.say('villain2', 'Boys, take care of them.');
    await Ev.battle(['boss_rufus'], { boss: true, noRun: true, bg: 'scrub', scene: 'boss2' });
    Ev.flag('boss_done:dungeon2');
    await Ev.say('villain2', 'You think this changes anything? Sephiroth already has the Pendant.');
    await Ev.say('hero3', 'Then we\'ll take it from him. Get lost.');
    await Ev.say(null, `${N.villain2} limps away. The road east over the mountain pass is clear.`);
    Ev.flag('gate_pass');
  },

  async boss3() {
    await Ev.say('villain5', 'So you came, fighter.');
    await Ev.say('hero2', 'You wanted a fight. Here I am.');
    await Ev.say('villain5', `Sephiroth told me about you. Let's see what you've got.`);
    await Ev.battle(['boss_viper'], { boss: true, noRun: true, bg: 'canyon', scene: 'boss3' });
    Ev.flag('boss_done:dungeon3');
    await Ev.say('villain5', 'Impossible... beaten by a wandering nobody...');
    await Ev.say('hero2', 'A fighter is never nobody.');
    await Ev.say(null, 'A rockslide thunders down the canyon. When the dust settles, the southern pass to the coast is open.');
    Ev.flag('gate_snow');
  },

  async boss4() {
    await Ev.say('villain6', 'You three again. Sephiroth said you\'d be a nuisance.');
    await Ev.say('hero1', 'Where is he? Where\'s the Pendant?');
    await Ev.say('villain6', 'You\'ll have to beat it out of me.');
    await Ev.battle(['boss_cartographer'], { boss: true, noRun: true, bg: 'cave', scene: 'boss4' });
    Ev.flag('boss_done:dungeon4');
    await Ev.say('villain6', 'You... will never... make it...');
    await Ev.say(null, 'Something falls from the villain\'s coat as he collapses. An old map.');
    await Ev.scene('map');
    await Ev.say('hero2', 'A map of an island. And an X.');
    await Ev.say('hero3', 'X marks the spot! That\'s where Sephiroth is!');
    await Ev.say('hero1', `We need a boat. The fishermen in ${P.town4} will lend us one.`);
    Ev.endScene();
    await Ev.say(null, 'A fisherman lends you his boat. It is moored at the eastern shore, facing the island.');
    Ev.flag('gate_rift');
    await Ev.give('elixir');
  },

  async boss5() {
    Music.play('sad');
    await Ev.scene('theater');
    await Ev.say(null, 'The old Roman theater. In the middle of the stage stands a familiar figure.');
    await Ev.say('hero1', `${N.aeris}?!`);
    await Ev.say('aeris', 'You came... I knew you would.');
    await Ev.say('hero2', 'What are you doing here? It\'s not safe!');
    await Ev.say('aeris', 'I followed him. I wanted to help. I wanted to...');
    Ev.sfx('dark'); Ev.flash();
    await Ev.say(null, `${N.villain1} appears behind her out of thin air.`);
    Ev.sfx('crit'); Ev.shake(30);
    await Ev.say('aeris', '...');
    await Ev.say(null, `${N.aeris} falls.`);
    await Ev.say('hero3', `${N.aeris.toUpperCase()}!!`);
    await Ev.say('villain1', 'Touching. The Pendant is awake now. This world ends tonight.');
    await Ev.say('hero1', `You took my father. You took ${N.aeris}. You're not taking anything else.`);
    Ev.endScene();
    await Ev.battle(['boss_sephiroth'], { boss: true, noRun: true, bg: 'theater', scene: 'final1', music: 'final' });
    await Ev.say('villain1', 'Then witness the Pendant\'s true power!');
    Ev.flash(); Ev.sfx('quake'); Ev.shake(60);
    await Ev.scene('final2');
    await Ev.say(null, `The Pendant blazes on ${N.villain1}'s chest. A storm of dark light fills the theater.`);
    await Ev.say(null, `The three friends stand together. Strength returns to them, as if ${N.aeris} were still watching.`);
    Ev.heal(); Ev.sfx('heal');
    Ev.endScene();
    await Ev.battle(['boss_sephiroth2'], { boss: true, noRun: true, bg: 'theater', scene: 'final2', music: 'final' });
    Ev.flag('boss_done:dungeon5');
    await this.ending();
  },

  async ending() {
    Music.play('ending');
    await Ev.scene('ending');
    await Ev.say(null, `${N.villain1} falls. The Pendant cracks and its light fades for good.`);
    await Ev.say('hero1', 'It\'s over, Dad.');
    await Ev.say('hero2', `For ${N.aeris}.`);
    await Ev.say('hero3', 'For everybody. The earth\'s still here, guys. We did it.');
    await Ev.say(null, 'Three friends, one boat, and a long way home.');
    Ev.endScene();
    Ev.flag('game_clear');
    await Scenes.push(new CreditsScene());
    if (Ev.field) await Ev.choice('Save your cleared game? (You can keep exploring.)', ['Save', 'No']) === 0 && await Scenes.push(new SaveScene());
  },

  async bossSecret() {
    await Ev.say(null, 'A colossus of gold stirs. It has guarded this shrine for a thousand years.');
    await Ev.battle(['boss_forgotten'], { boss: true, noRun: true, bg: 'shrine', music: 'final' });
    Ev.flag('boss_done:secret');
    await Ev.say(null, 'The colossus bows its head and crumbles to dust, leaving something behind.');
    await Ev.give('herocrest');
  },

  // the boat crossing: step onto the pier once it is open
  async onStep(mapId, x, y, f) {
    if (mapId !== 'world' || Ev.has('jetski_done') || !Ev.has('gate_rift')) return false;
    const g = f.map.gates.find(g => g.flag === 'gate_rift');
    if (!g || Math.abs(x - g.x) > 2 || y !== g.y) return false;
    f.run(() => this.boatTrip(f));
    return true;
  },

  // ---------------------------------------------------------------- NPCs
  npcs(mapId) {
    const L = VILLAGER_LOOKS, has = k => Ev.has(k);
    const talk = (...lines) => async ev => { for (const l of lines) await ev.say(null, typeof l === 'function' ? l() : l); };
    switch (mapId) {
      case 'town1': return [
        { x: 11, y: 4, look: CAST.father.look, talk: talk('Your father was a good man, Terry. The whole town remembers that night.') },
        { x: 8, y: 8, look: L[0], wander: true, talk: talk(() => has('boss_done:dungeon1') ? 'They fixed the north bridge! The harbor is a short walk now.' : 'People hear screaming in the forest at night. Don\'t go in there!') },
        { x: 15, y: 7, look: L[1], wander: true, talk: talk('Press B (or X) to open the menu. Equip anything you buy, or it won\'t help you!') },
        { x: 7, y: 15, look: L[4], wander: true, talk: talk('Each of you fights differently. Terry hits hard, Ryu heals with his ki, Barret shoots everything.') }
      ];
      case 'town2': return [
        { x: 8, y: 8, look: L[2], wander: true, talk: talk(() => has('boss_done:dungeon2') ? 'The men in black suits are gone! Thank you!' : 'Men in black suits came through. Their boss wears sunglasses even at night.') },
        { x: 15, y: 9, look: L[3], wander: true, talk: talk(() => has('gate_pass') ? 'The mountain pass east is open. The olive hills are past it.' : 'The mountain pass to the east has been blocked for years.') },
        { x: 13, y: 14, look: L[0], wander: true, talk: talk('Phoenix Downs bring a fallen friend back. Never travel without a few.') }
      ];
      case 'town3': return [
        { x: 8, y: 8, look: L[3], wander: true, talk: talk(() => has('boss_done:dungeon3') ? 'That fighter you beat used to scare the whole village!' : 'A strange fighter waits in the canyon. He beats everyone who comes.') },
        { x: 15, y: 9, look: L[2], wander: true, talk: talk('Earth creatures hate water. Bring Zeus Orbs and Arctic Winds.') },
        { x: 6, y: 15, look: L[1], wander: true, talk: talk('There\'s an old shrine east of here. They say nobody who went in ever came back.') }
      ];
      case 'town4': return [
        { x: 8, y: 8, look: L[4], wander: true, talk: talk(() => has('gate_rift') ? 'Your boat is at the eastern shore. Watch out for jet skis, they\'re crazy around the island!' : 'A man with a map has been hiding in the cliffs south-west of here.') },
        { x: 15, y: 9, look: L[0], wander: true, talk: talk('On a clear day you can see an island out east. Nobody goes there anymore.') },
        { x: 13, y: 14, look: L[3], wander: true, talk: talk('Fire won\'t work on everything. Watch which attacks hurt an enemy most.') },
        { x: 9, y: 13, look: SHOP_LOOKS.weapons, hidden: () => !has('gate_rift'), talk: async ev => {
          await ev.say(null, 'Heading to the island? Take the best gear money can buy.');
          await Scenes.push(new ShopScene(['crystalknuckles', 'sageband', 'thundercannon', 'crystalmail', 'lumenrobe', 'shadowgarb', 'xpotion', 'hiether'], 'Wandering Merchant'));
        } }
      ];
    }
    return [];
  }
};

class CreditsScene {
  constructor() { this.opaque = true; this.t = 0; this.lines = []; }
  enter() {
    const L = this.lines;
    L.push([CONFIG.title, '#ffe080', 16], [CONFIG.subtitle || '', '#fff'], ['', ''], ['CAST', '#a0c0ff']);
    for (const id of Object.keys(CAST)) L.push([CAST[id].name, '#ffe080'], [CAST[id].actor || '', '#fff'], ['', '']);
    L.push(['', ''], [CONFIG.credits || '', '#fff'], ['', ''], ['Thank you for playing!', '#ffe080'], ['', ''], [`Time ${fmtTime(S.time)}`, '#c0c0d0']);
  }
  update() { this.t++; if (this.t > 200 && (Input.pressed('a') || this.t > this.lines.length * 26 * 2.2 + 400)) Scenes.pop(this); }
  draw() {
    drawSkyBackdrop('ending', this.t);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, SW, SH);
    const y0 = SH - this.t / 2.2;
    this.lines.forEach(([s, c, sz], i) => { const y = y0 + i * 18; if (y > -20 && y < SH) txt(s, SW / 2, y, c, 'center', sz || 8); });
  }
}
