// =====================================================================
//  STORY  —  the placeholder plot. Rewrite the dialogue to follow your movie.
// =====================================================================
//  Ev.say('hero1', 'text')            a line of dialogue (portrait + voice)
//  Ev.say('hero1', 'text', 'assets/voices/line.mp3')   ...with a recorded clip
//  Ev.say(null, 'text')               narration
//  Ev.scene('intro', 'caption')       full-screen backdrop (movie still from CONFIG.scenes)
//  Ev.title('Chapter 1', 'Name')      chapter title card
//  ${N.hero1}  inserts a character's name, ${P.town1} a place name
// =====================================================================
'use strict';

const STORY = {
  musicFor(mapId) {
    if (mapId.startsWith('dungeon5')) return 'rift';
    if (mapId === 'world') return 'field';
    return null;
  },

  // ---------------------------------------------------------------- opening
  async intro() {
    await Ev.scene('intro');
    Music.play('title');
    await Ev.say(null, `Long ago, four Dawn Crystals were set across ${P.world} to hold the sky together.`);
    await Ev.say(null, 'As long as they shine, the Rift beneath the world stays closed.');
    await Ev.say(null, 'But someone has been listening to the Rift... and it has been answering.');
    Ev.endScene();
    await Ev.title('PROLOGUE', 'The Night of Lanterns');
  },

  canEnter(id) {
    if (id === 'secret' && !Ev.has('gate_rift')) return 'An ancient seal glows on the door. It will not open... yet.';
    return null;
  },

  // ---------------------------------------------------------------- map events
  async onEnter(mapId, f) {
    if (mapId === 'town1' && !Ev.has('intro_done')) return this.festival(f);
    if (mapId === 'town1' && Ev.has('boss_done:dungeon1') && !Ev.has('ch1_return')) return this.ch1Return();
    if (mapId === 'town2' && !Ev.has('ch2_start')) return this.ch2Start();
    if (mapId === 'town3' && !Ev.has('ch3_start')) return this.ch3Start();
    if (mapId === 'town4' && !Ev.has('ch4_start')) return this.ch4Start();
    if (mapId === 'dungeon5:0' && !Ev.has('ch5_enter')) {
      Ev.flag('ch5_enter');
      await Ev.say('hero1', 'This is it. Whatever happens in here... we face it together.');
      await Ev.say('hero2', 'Together. Always.');
    }
  },

  async festival(f) {
    Ev.flag('intro_done');
    await Ev.scene('festival', P.town1);
    Music.play('town');
    await Ev.say('elder', `${N.hero1}! There you are. The Lantern Festival is about to begin.`);
    await Ev.say('hero1', 'Sorry, Elder. I was up at the old shrine. The crystal there felt... strange tonight.');
    await Ev.say('hero2', `Strange how? You always say that, ${N.hero1}.`);
    await Ev.say('hero1', 'It was flickering. Like it was afraid of something.');
    Music.stop(); Ev.sfx('quake'); Ev.shake(40); await Ev.wait(40);
    await Ev.scene('intro');
    await Ev.say(null, 'The sky above the village splits open with a sound like breaking glass.');
    await Ev.say('villain4', 'Heh heh heh! Evening, villagers! Don\'t mind me, just here for a little shiny rock!');
    await Ev.say('elder', 'The Verdant Crystal! Stop! Without it the woods will wither!');
    await Ev.say('villain4', `Lord ${N.villain1} needs it more than you do! Catch me in ${P.dungeon1} if you can! Ha!`);
    Ev.endScene();
    Music.play('town');
    await Ev.say('hero2', 'That creep! I\'m coming with you. Don\'t even try to argue.');
    await Ev.join('hero2');
    await Ev.say('elder', `${P.dungeon1} lies to the south-east. Take these, and be careful.`);
    await Ev.give('potion', 3);
    await Ev.title('CHAPTER 1', 'The Spark');
    Ev.setChapter(1); Ev.flag('ch1_start');
  },

  async ch1Return() {
    Ev.flag('ch1_return');
    await Ev.say('elder', `You're back! And... ${N.villain2}? I have heard that name in old stories. None of them end well.`);
    await Ev.say('elder', `The northern bridge has been rebuilt. Go to the port of ${P.town2}. Ships hear news from every corner of the world.`);
    await Ev.gil(300);
  },

  async ch2Start() {
    Ev.flag('ch2_start'); Ev.setChapter(2);
    await Ev.title('CHAPTER 2', 'Salt and Stone');
    await Ev.scene('port', P.town2);
    await Ev.say(null, 'The harbor is silent. Sailors lie sick along the docks.');
    await Ev.say('hero3', 'Easy, easy... drink this. Slowly.');
    await Ev.say('hero1', 'What happened here?');
    await Ev.say('hero3', `The water turned black three days ago. Something woke in the ${P.dungeon2} and poisoned the bay.`);
    await Ev.say('hero3', 'I can treat the sick, but it won\'t stop until someone deals with whatever is down there.');
    await Ev.say('hero2', 'Then let\'s deal with it. We\'re chasing the people behind this anyway.');
    await Ev.say('hero3', 'You\'re serious? ...Fine. You\'ll need a healer down there. I\'m coming.');
    Ev.endScene();
    await Ev.join('hero3');
    await Ev.say('hero3', `The grotto is just south-west of town, by the cliffs.`);
  },

  async ch3Start() {
    Ev.flag('ch3_start'); Ev.setChapter(3);
    await Ev.title('CHAPTER 3', 'Frostbound');
    await Ev.scene('snow', P.town3);
    await Ev.say(null, 'Someone bumps into the party in the snow-covered square.');
    await Ev.say('hero4', 'Oops! Sorry, sorry. Cold hands, you know how it is.');
    await Ev.say('hero3', `...${N.hero1}, check your pockets.`);
    await Ev.say('hero1', 'Hey! Give that back!');
    await Ev.say('hero4', `Okay, okay! Look... ${N.villain3} pays me to rob travellers. Everyone in ${P.town3} works for the Warden or freezes.`);
    await Ev.say('hero4', `But you lot are going after the Frost Crystal, right? Take me with you. I know every secret door in ${P.dungeon3}.`);
    await Ev.say('hero2', 'Can we trust a thief?');
    await Ev.say('hero4', 'You can trust a thief who wants to go home. That\'s me.');
    Ev.endScene();
    await Ev.join('hero4');
    await Ev.say('hero4', `${P.dungeon3} is at the far north-east of the snowfields. Dress warm.`);
  },

  async ch4Start() {
    Ev.flag('ch4_start'); Ev.setChapter(4);
    await Ev.title('CHAPTER 4', 'Ashes');
    await Ev.scene('desert', P.town4);
    await Ev.say('hero2', 'Three crystals gone. Only the Ember Crystal is left.');
    await Ev.say('hero4', `And ${N.villain2} will be guarding it personally. ${P.dungeon4} is south-west of here, past the dunes.`);
    await Ev.say('hero3', 'Then we rest, we stock up, and we go. No more arriving too late.');
    await Ev.say('hero1', 'This time we get there first.');
    Ev.endScene();
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
    await Ev.say('villain4', 'You followed me?! Nobody ever follows me!');
    await Ev.say('hero1', 'Give back the crystal, and nobody gets hurt.');
    await Ev.say('villain4', 'Ha! I\'ve been practising! Get them, me!');
    await Ev.battle(['boss_grimble'], { boss: true, noRun: true, bg: 'woods', scene: 'boss1' });
    Ev.flag('boss_done:dungeon1');
    await Ev.say('villain4', 'Ow ow ow... fine! Take it! It\'s... wait, where did it go?');
    await Ev.scene('boss1');
    await Ev.say('villain2', 'You were told to bring it straight back, Grimble.');
    await Ev.say('villain4', `${N.villain2}! I was just... resting!`);
    await Ev.say('villain2', `So you are the village children. ${N.villain1} will be amused. Enjoy your little victory.`);
    Ev.flash(); Ev.sfx('dark');
    await Ev.say(null, `${N.villain2} vanishes in a swirl of shadow, taking the Verdant Crystal and the trembling henchman along.`);
    Ev.endScene();
    await Ev.say('hero2', 'We were too late...');
    await Ev.say('hero1', `Then we keep going. Let's get back to ${P.town1}.`);
    Ev.flag('gate_bridge');
  },

  async boss2() {
    await Ev.say(null, 'The black water churns. Something enormous rises from the depths.');
    await Ev.say('hero3', 'That\'s it. That\'s what poisoned the bay!');
    await Ev.battle(['boss_serpent'], { boss: true, noRun: true, bg: 'cave', scene: 'boss2' });
    Ev.flag('boss_done:dungeon2');
    await Ev.say(null, 'The serpent sinks, and the water slowly turns clear.');
    await Ev.say('hero3', 'The shrine behind it... it\'s empty. The Tide Crystal is gone.');
    await Ev.say('hero2', `The serpent was a distraction. ${N.villain1}'s people were here first again.`);
    await Ev.say('hero1', 'Where would they go next?');
    await Ev.say('hero3', `North, over the mountains. The Frost Crystal is in ${P.dungeon3}. The harbor guild can open the old mountain pass for us.`);
    Ev.flag('gate_pass');
    await Ev.say(null, 'The guild clears the boulder from the mountain pass to the east.');
  },

  async boss3() {
    await Ev.say('villain3', `So the little thief came home. And brought friends.`);
    await Ev.say('hero4', `I'm done working for you, ${N.villain3}. ${P.town3} is done working for you.`);
    await Ev.say('villain3', 'Then you can all stay here. Forever. Frozen.');
    await Ev.battle(['boss_hask'], { boss: true, noRun: true, bg: 'ice', scene: 'boss3' });
    Ev.flag('boss_done:dungeon3');
    await Ev.say('villain3', `Fools... It doesn't matter... ${N.villain1} already has what was needed...`);
    Music.play('final');
    await Ev.scene('boss3');
    await Ev.say('villain1', 'Indeed I do.');
    await Ev.say('hero1', `${N.villain1}!`);
    await Ev.say('villain1', `Three crystals. One left. And you have been so helpful, clearing the way for me each time.`);
    await Ev.say('villain1', 'When the last crystal breaks, the Rift will open, and I will rebuild this tired world from nothing.');
    await Ev.say('hero2', 'People live in this "tired world"!');
    await Ev.say('villain1', 'People will live in the next one too. Better ones.');
    Ev.flash(); Ev.sfx('dark');
    await Ev.say(null, `${N.villain1} tears the Frost Crystal from its pedestal and disappears. The keep groans. Somewhere below, a great avalanche roars.`);
    Ev.endScene();
    await Ev.say('hero4', 'That noise... the southern pass! The avalanche must have broken the ice wall.');
    await Ev.say('hero1', 'The road south is open. To the desert.');
    Ev.flag('gate_snow');
  },

  async boss4() {
    await Ev.say('villain2', `Persistent. I'll give you that.`);
    await Ev.say('hero1', `It's over, ${N.villain2}. Step away from the crystal.`);
    await Ev.say('villain2', 'Over? It has barely begun.');
    await Ev.battle(['boss_sable'], { boss: true, noRun: true, bg: 'ruins', scene: 'boss4' });
    Ev.flag('boss_done:dungeon4');
    await Ev.say('villain2', `...Strong. Stronger than ${N.villain1} believed.`);
    await Ev.say('villain2', 'Listen to me. The Rift does not rebuild anything. It only consumes. I have seen it.');
    await Ev.say('hero3', 'Then why help?');
    await Ev.say('villain2', 'Because I believed there was nothing left worth saving. Perhaps I was wrong.');
    Music.play('final');
    await Ev.scene('rift');
    await Ev.say('villain1', `Sentimental to the end, ${N.villain2}.`);
    Ev.flash(); Ev.sfx('quake'); Ev.shake(60);
    await Ev.say(null, 'The four Dawn Crystals shatter at once. Far to the east, the sky tears open.');
    await Ev.say('villain1', 'Come, if you wish to watch the end. My Citadel awaits.');
    Ev.endScene();
    await Ev.say('hero2', 'The Rift... it\'s open.');
    await Ev.say('hero1', 'Not for long.');
    Ev.flag('gate_rift'); Ev.setChapter(5);
    await Ev.title('CHAPTER 5', 'First Fantasy');
    await Ev.say(null, `A bridge of light has formed in the wasteland east of ${P.town4}.`);
  },

  async boss5() {
    Music.play('final');
    await Ev.scene('final1');
    await Ev.say('villain1', 'You came. Good. Someone should witness the birth of a new world.');
    await Ev.say('hero1', 'We\'re not here to watch.');
    await Ev.say('hero3', 'We\'re here to bring the old one home.');
    await Ev.say('hero4', 'And to get back everything you stole. I\'m a professional.');
    await Ev.say('hero2', `It ends here, ${N.villain1}.`);
    Ev.endScene();
    await Ev.battle(['boss_vexis'], { boss: true, noRun: true, bg: 'rift', scene: 'final1', music: 'final' });
    await Ev.say('villain1', 'Then... let the Rift itself answer you!');
    Ev.flash(); Ev.sfx('quake'); Ev.shake(60);
    await Ev.scene('final2');
    await Ev.say(null, `${N.villain1} dives into the heart of the Rift, and something vast rises in their place.`);
    await Ev.say(null, 'The shards of the four Dawn Crystals blaze around the party. Wounds close. Strength returns.');
    Ev.heal(); Ev.sfx('heal');
    Ev.endScene();
    await Ev.battle(['boss_vexis2'], { boss: true, noRun: true, bg: 'rift', scene: 'final2', music: 'final' });
    Ev.flag('boss_done:dungeon5');
    await this.ending();
  },

  async ending() {
    Music.play('ending');
    await Ev.scene('ending');
    await Ev.say(null, 'The Rift collapses into a single point of light... and goes out.');
    await Ev.say(null, 'Across the world, four small sparks rise from the ground and settle where the crystals once stood.');
    await Ev.say('hero2', 'We did it... we actually did it.');
    await Ev.say('hero3', 'The bay will heal. The snow will thaw. Everything will grow back.');
    await Ev.say('hero4', 'So... does this make me a hero now? Do heroes get paid?');
    await Ev.say('hero1', `Come on. Let's go home. ${P.town1} owes us a festival.`);
    Ev.endScene();
    Ev.flag('game_clear');
    await Scenes.push(new CreditsScene());
    if (Ev.field) await Ev.choice('Save your cleared game? (You can keep exploring.)', ['Save', 'No']) === 0 && await Scenes.push(new SaveScene());
  },

  async bossSecret() {
    await Ev.say(null, 'A colossus of gold stirs. It has guarded this shrine since before the crystals were made.');
    await Ev.battle(['boss_forgotten'], { boss: true, noRun: true, bg: 'shrine', music: 'final' });
    Ev.flag('boss_done:secret');
    await Ev.say(null, 'The colossus bows its head and crumbles to dust, leaving something behind.');
    await Ev.give('herocrest');
  },

  // ---------------------------------------------------------------- NPCs
  npcs(mapId) {
    const L = VILLAGER_LOOKS, has = k => Ev.has(k);
    const talk = (...lines) => async ev => { for (const l of lines) await ev.say(null, typeof l === 'function' ? l() : l); };
    switch (mapId) {
      case 'town1': return [
        { x: 11, y: 4, cast: 'elder', talk: async ev => {
          if (!has('boss_done:dungeon1')) await ev.say('elder', `${P.dungeon1} is south-east of the village. Rest at the inn if you are hurt.`);
          else await ev.say('elder', 'Whatever you face out there, remember you always have a home here.');
        } },
        { x: 8, y: 8, look: L[0], wander: true, talk: talk(() => has('boss_done:dungeon1') ? 'They rebuilt the bridge in one night! Can you believe it?' : 'Grimble ran off with the crystal! The woods are already turning grey.') },
        { x: 15, y: 7, look: L[1], wander: true, talk: talk('Press B (or X) to open the menu. Equip anything you buy, or it won\'t help you!') },
        { x: 7, y: 15, look: L[4], wander: true, talk: talk('Monsters get tougher the further you travel. Fight a little in each new area before pushing on.') }
      ];
      case 'town2': return [
        { x: 8, y: 8, look: L[2], wander: true, talk: talk(() => has('boss_done:dungeon2') ? 'The water is clear again! The fish are back!' : 'Cough... the water... don\'t drink the water...') },
        { x: 15, y: 9, look: L[3], wander: true, talk: talk(() => has('gate_pass') ? 'The pass east is open. The snowfields are past it. Bring warm clothes!' : 'The mountain pass to the east has been sealed for years.') },
        { x: 13, y: 14, look: L[0], wander: true, talk: talk('Healers here sell Phoenix Downs. Never leave port without a few.') }
      ];
      case 'town3': return [
        { x: 8, y: 8, look: L[3], wander: true, talk: talk(() => has('boss_done:dungeon3') ? 'The Warden is gone! We can light our fires again!' : 'Shh! The Warden\'s knights are always listening.') },
        { x: 15, y: 9, look: L[2], wander: true, talk: talk('Frost monsters hate fire. Bomb Shards work wonders up here.') },
        { x: 6, y: 15, look: L[1], wander: true, talk: talk(`There's an old shrine east of here. They say nobody who went in ever came back.`) }
      ];
      case 'town4': return [
        { x: 8, y: 8, look: L[4], wander: true, talk: talk(`${P.dungeon4} burns day and night. Ice magic is your friend in there.`) },
        { x: 15, y: 9, look: L[0], wander: true, talk: talk(() => has('gate_rift') ? 'The sky to the east... it\'s torn open. Are you really going in there?' : 'Sandstorms are bad this season. Stay on the dunes.') },
        { x: 13, y: 14, look: L[3], wander: true, talk: talk('Rogues can steal rare things from powerful monsters. Some items cannot be bought anywhere.') },
        { x: 9, y: 13, look: SHOP_LOOKS.weapons, hidden: () => !has('gate_rift'), talk: async ev => {
          await ev.say(null, 'Psst. Final-journey supplies. Best gear money can buy.');
          await Scenes.push(new ShopScene(['crystalsaber', 'starrod', 'seraphstaff', 'shadowblade', 'crystalmail', 'lumenrobe', 'shadowgarb', 'xpotion', 'hiether'], 'Wandering Merchant'));
        } }
      ];
    }
    return [];
  },

  async onStep() { return false; }
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
