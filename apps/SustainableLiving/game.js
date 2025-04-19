const config = {
    type: Phaser.AUTO,
    width: 480, // Scratch stage width
    height: 360, // Scratch stage height
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 }, // Items will have their own velocity
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

// --- Global Variables Equivalent ---
let score = 0;
let isRunning = false; // Equivalent to Scratch 'Running' variable (true = 1, false = 0)
let scoreText;
let player;
let goodItems;
let badItems;
let cursors;
let goodItemTimer;
let badItemTimer;

// --- Quiz Data (Extracted from Scratch JSON) ---
const questions = [
    "Which action helps save electricity?? (a) Leaving the lights on all day (b) Keeping the TV on while you sleep (c) Opening the fridge every minute (d) Turning off lights when you leave a room",
    "What is the best way to bring water to school?? (a) Metal can you use once (b) Glass that has no lid (c) Throw‑away plastic bottle (d) Reusable water bottle",
    "Which of these is the most Earth‑friendly way to travel a short distance?? (a) Riding a bicycle (b) Riding a motorbike fast (c) Driving alone in a car (d) Taking a taxi for one block",
    "Where should you put an empty soda can?? (a) Under your desk (b) In the sink (c) In the recycling bin (d) On the playground",
    "What does it mean to “reuse” something?? (a) Throw it away (b) Use it again (c) Break it (d) Lend it once",
    "Which food choice helps the planet most?? (a) Flying fruit in from far away (b) Throwing food on the ground (c) Wasting half your lunch (d) Eating food grown nearby",
    "Which of these wastes the most water?? (a) Turning off the tap while brushing teeth (b) Fixing a dripping tap (c) Collecting rainwater for plants (d) Taking a very long shower",
    "What should you do with old clothes that still look good?? (a) Burn them (b) Donate or swap them (c) Throw them in the trash (d) Hide them under the bed",
    "Which habit makes less trash?? (a) Buying food in many small plastic packs (b) Taking new plastic cutlery each meal (c) Using a lunchbox every day (d) Throwing away half‑used notebooks",
    "Why is planting trees helpful?? (a) Trees give shade and clean air (b) Trees block the sun for solar panels (c) Trees drink all the water (d) Trees make more garbage",
    "Which light bulb uses less energy?? (a) LED (b) Bulb left on all night (c) Old‑style incandescent (d) Broken bulb",
    "What does “composting” mean?? (a) Flushing scraps down the toilet (b) Throwing food scraps in landfill (c) Mixing food scraps with soil to make plant food (d) Packing scraps in plastic bags",
    "Which of these is NOT good for our oceans?? (a) Saying no to plastic straws (b) Dropping plastic into rivers (c) Reusing shopping bags (d) Cleaning up beaches",
    "The three “R” words in waste management are Reduce, Reuse, _____.? (a) Replace (b) Recycle (c) Rethink (d) Remove", // Adjusted Q14 for clarity
    "What can you do with paper printed on one side?? (a) Burn it right away (b) Soak it in water (c) Use the blank side for notes (d) Crumple and throw it away",
    "Which uses the least packaging?? (a) Buying fruit wrapped in plastic and tape (b) Buying apples in foam nets and bags (c) Buying fruit in plastic boxes (d) Buying loose apples",
    "Which way saves more fuel?? (a) Carpooling with friends (b) Driving alone everywhere (c) Leaving the engine running while parked (d) Racing the car fast",
    "How can you save paper at school?? (a) Write on both sides of the paper (b) Use new notebooks for each lesson (c) Throw worksheets after one look (d) Print every email",
    "Which activity helps wildlife?? (a) Chasing animals (b) Cutting trees for fun (c) Throwing trash in rivers (d) Protecting forests",
    "What is a “solar panel” used for?? (a) Cooling the house with fans (b) Saving rainwater (c) Catching wind (d) Making electricity from the sun",
    "Which drink container is easiest to recycle?? (a) Cup with plastic‑foam lining (b) Aluminum can (c) Juice box with layers (d) Plastic pouch",
    "Turning the thermostat up in summer (so the room is warmer) will _____.? (a) Use more energy (b) Use less energy (c) Fix the air‑con (d) Make ice",
    "Which is a renewable energy source?? (a) Wind (b) Oil (c) Coal (d) Natural gas",
    "Why should we carry a cloth shopping bag?? (a) It is heavier than plastic bags (b) It tears on first use (c) It can be used many times (d) It adds extra trash",
    "Which habit keeps indoor air cleaner?? (a) Using nontoxic cleaners (b) Burning plastic (c) Smoking indoors (d) Spraying strong chemicals",
    "Which choice saves more water when washing hands?? (a) Use a hose (b) Wet hands, turn off tap, soap up, rinse (c) Leave tap running (d) Wash with bottled water", // Adjusted Q26 for better options
    "Which action helps bees and butterflies?? (a) Pouring oil on soil (b) Cutting all flowers (c) Spraying garden with harsh bug killer (d) Planting native flowers",
    "Eating all the food on your plate helps achieve _____.? (a) Trash time (b) Zero waste (c) Plate waste (d) Food waste", // Adjusted Q28
    "Which uses less plastic?? (a) Using a straw with every sip (b) Buying single‑use cups (c) Buying a big bottle and sharing (d) Buying many tiny bottles",
    "What should you do with dead batteries?? (a) Throw them in the regular bin (b) Bury them in the yard (c) Put them in special battery recycling (d) Toss them in a fire",
    "Why is walking to school good?? (a) It makes loud noise (b) It releases dirty smoke (c) It uses lots of petrol (d) It keeps you healthy and saves fuel",
    "Which of these lamps wastes the MOST energy?? (a) Using an LED lamp (b) Reading near a window in daylight (c) Leaving a desk lamp on all night (d) Turning off the lamp when done",
    "What can we make from recycled paper?? (a) Fresh fruit (b) Glass bottles (c) Metal cans (d) New paper products",
    "Choosing toys made of wood instead of new plastic helps because _____.? (a) Wood cannot be reused (b) Wood grows back and breaks down (c) Plastic comes from trees (d) Wood never breaks",
    "Which of these is single‑use plastic?? (a) Metal spoon (b) Wooden block (c) Cloth napkin (d) Plastic straw used once",
    "What does an energy‑efficient sticker on an appliance mean?? (a) It makes noise (b) It is extra large (c) It uses less electricity (d) It breaks quickly",
    "How can we keep a room cool without air‑conditioning?? (a) All of the above (b) Close curtains to keep sun out (c) Open windows for fresh air (d) Use ceiling fans",
    "Which activity creates the most trash at lunch?? (a) Buying heavily wrapped snacks (b) Ordering food with no packaging (c) Sharing food to finish it (d) Bringing food in reusable containers",
    "What is “green transport”?? (a) Driving very fast (b) Vehicles that pollute a lot (c) Ways of travel that are kind to Earth (d) Flying every weekend",
    "Turning off the computer when not needed helps by _____.? (a) Making the room hotter (b) Slowing homework (c) Saving electricity (d) Using more power",
    "Refillable pens are better than one‑time pens because _____.? (a) They can be used again and again (b) They cost more fuel (c) They run out faster (d) They look older",
    "Why is it good to eat more fruits and vegetables?? (a) They usually need less energy to grow than meat (b) They make more greenhouse gas (c) They never rot (d) They use lots of plastic",
    "Which habit protects clean water?? (a) Using eco‑friendly soap (b) Throwing trash in rivers (c) Pouring oil down the drain (d) Washing paint into sinks",
    "What happens when we reduce our energy use?? (a) Less pollution is made (b) More coal is burned (c) Trees get cut faster (d) More smoke goes into the air",
    "Bringing your own straw to a café helps by _____.? (a) Creating new plastic (b) Making drinks taste bad (c) Reducing single‑use plastic (d) Breaking the straw quickly",
    "Which is the BEST place for old glass bottles?? (a) Plastic bin (b) Glass recycling bin (c) Compost pile (d) Garden soil",
    "Collecting rainwater can be used for _____.? (a) Filling swimming pools only (b) Pouring into storm drains (c) Drinking without cleaning (d) Watering plants",
    "Which electronic device uses energy even when “off” but still plugged in?? (a) Book on a shelf (b) TV in standby mode (c) Pencil case (d) Paper poster",
    "Why should we fix a leaking faucet quickly?? (a) To waste more water (b) To save water (c) To make louder drips (d) To clean the sink", // Adjusted Q49
    "Riding a bus instead of many cars helps because _____.? (a) It takes more fuel per person (b) It carries many people and cuts pollution (c) It uses only one seat (d) It makes more traffic"
];

const answers = [
    "d", "d", "a", "c", "b", "d", "d", "b", "c", "a", "a", "c", "b", "b", "c",
    "d", "a", "a", "d", "d", "b", "b", "a", "c", "a", "b", "d", "b", "c", "c",
    "d", "c", "d", "b", "d", "c", "a", "a", "c", "c", "a", "a", "a", "a", "c",
    "b", "d", "b", "b", "b"
];

// --- Phaser Scene Functions ---

function preload() {
    // Load images (adjust paths if needed)
    this.load.svg('backdrop1', 'assets/backdrop1.svg', { width: 480, height: 360 });
    this.load.svg('backdrop2', 'assets/backdrop2.svg', { width: 480, height: 360 });
    this.load.svg('bin', 'assets/bin.svg', { width: 154, height: 178 }); // Original size, will scale later

    // Good items
    this.load.svg('apple', 'assets/apple.svg', { width: 62, height: 62 });
    this.load.svg('bananas', 'assets/bananas.svg', { width: 78, height: 76 });
    this.load.svg('watermelon', 'assets/watermelon.svg', { width: 80, height: 56 });

    // Bad items
    this.load.svg('donut', 'assets/donut.svg', { width: 80, height: 46 });
    this.load.image('cheesypuffs', 'assets/cheesypuffs.png'); // PNG uses image loader
    this.load.svg('taco', 'assets/taco.svg', { width: 78, height: 48 });

    // Optional: Load sounds
    // this.load.audio('pop', 'assets/pop.wav');
    // this.load.audio('chomp', 'assets/chomp.wav');
    // this.load.audio('bite', 'assets/bite.wav');
}

function create() {
    // Set background (using backdrop1 initially)
    this.add.image(240, 180, 'backdrop1'); // Centered

    // Create player (Bin)
    // Initial position from Scratch: x=0, y=-135 (bottom center)
    player = this.physics.add.sprite(config.width / 2, config.height - 45, 'bin');
    player.setScale(0.2); // Match Scratch size 20%
    player.setCollideWorldBounds(true); // Keep player on screen
    player.body.immovable = true; // Important for collisions with falling items

    // Create groups for falling items
    goodItems = this.physics.add.group();
    badItems = this.physics.add.group();

    // Score display
    score = 0; // Reset score on create
    scoreText = this.add.text(10, 10, 'Score: 0', { fontSize: '24px', fill: '#FFFFFF', stroke: '#000000', strokeThickness: 4 });

    // Input handling
    cursors = this.input.keyboard.createCursorKeys();

    // Collision detection
    this.physics.add.overlap(player, goodItems, collectGoodItem, null, this);
    this.physics.add.overlap(player, badItems, hitBadItem, null, this);

    // Start the game
    startGame.call(this); // Use .call(this) to maintain scene context
}

function update(time, delta) {
    if (!isRunning) {
        player.setVelocityX(0); // Stop player if game is paused
        return; // Don't process movement or check item bounds if paused
    }

    // Player movement
    if (cursors.left.isDown) {
        player.setVelocityX(-250); // Adjust speed as needed
    } else if (cursors.right.isDown) {
        player.setVelocityX(250);
    } else {
        player.setVelocityX(0);
    }

    // Check if items fall off the bottom
    checkItemBounds(goodItems);
    checkItemBounds(badItems);
}

// --- Helper Functions ---

function startGame() {
    console.log("Starting game...");
    score = 0;
    scoreText.setText('Score: ' + score);
    isRunning = true;

    // Clear existing items if restarting
    goodItems.clear(true, true);
    badItems.clear(true, true);

    // Remove old timers if they exist before creating new ones
    if (goodItemTimer) goodItemTimer.remove();
    if (badItemTimer) badItemTimer.remove();


    // Start timers for spawning items (use 'this' from create/startGame)
    goodItemTimer = this.time.addEvent({
        delay: Phaser.Math.Between(1500, 4000), // Random delay like Scratch
        callback: spawnGoodItem,
        callbackScope: this, // Pass scene context
        loop: true
    });

    badItemTimer = this.time.addEvent({
        delay: Phaser.Math.Between(1500, 4000), // Random delay
        callback: spawnBadItem,
        callbackScope: this, // Pass scene context
        loop: true
    });

     // Make sure player is in starting position
     player.setPosition(config.width / 2, config.height - 45);
     player.setVelocityX(0); // Ensure player isn't moving initially
}


function spawnGoodItem() {
    if (!isRunning) return; // Don't spawn if paused

    const x = Phaser.Math.Between(20, config.width - 20); // Random x position
    const y = -50; // Start above screen
    const goodChoices = ['apple', 'bananas', 'watermelon'];
    const choice = Phaser.Math.RND.pick(goodChoices);

    const item = goodItems.create(x, y, choice);
    item.setScale(0.5); // Match Scratch size 50% (adjust if needed)
    item.setVelocityY(Phaser.Math.Between(60, 200)); // Random speed (like Scratch random speed / 50)
    item.setCollideWorldBounds(false); // Let them fall off screen
    item.body.allowGravity = false; // We control velocity directly
}

function spawnBadItem() {
    if (!isRunning) return; // Don't spawn if paused

    const x = Phaser.Math.Between(20, config.width - 20);
    const y = -50;
    const badChoices = ['donut', 'cheesypuffs', 'taco'];
    const choice = Phaser.Math.RND.pick(badChoices);

    const item = badItems.create(x, y, choice);
    item.setScale(0.5); // Match Scratch size 50% (adjust if needed)
    item.setVelocityY(Phaser.Math.Between(60, 200));
    item.setCollideWorldBounds(false);
    item.body.allowGravity = false;
}

function checkItemBounds(group) {
    group.children.iterate(function (item) {
        if (item && item.y > config.height + 50) { // Check if item is well below the screen
            item.destroy(); // Remove item if it falls off
        }
    });
}


function collectGoodItem(player, item) {
    if (!isRunning) return; // Prevent collection during quiz

    item.destroy(); // Remove the item
    score += 1;
    scoreText.setText('Score: ' + score);
    // Optional: Play sound
    // this.sound.play('chomp');
    console.log("Caught good item! Score:", score);
}

function hitBadItem(player, item) {
    if (!isRunning) return; // Prevent multiple triggers if already in quiz

    item.destroy(); // Remove the item
    console.log("Hit bad item! Triggering quiz...");
    // Optional: Play sound
    // this.sound.play('bite');
    askQuestion.call(this); // Use .call(this) to keep scene context
}

function askQuestion() {
    if (!isRunning) return; // Ensure we don't double-trigger

    isRunning = false; // Pause the game
    console.log("Game Paused for Quiz");

    // Stop timers temporarily by pausing them
    if (goodItemTimer) goodItemTimer.paused = true;
    if (badItemTimer) badItemTimer.paused = true;

    // Optionally pause all items in groups
    Phaser.Actions.Call(goodItems.getChildren(), item => item.body.stop());
    Phaser.Actions.Call(badItems.getChildren(), item => item.body.stop());


    // Select random question
    const index = Phaser.Math.Between(0, questions.length - 1);
    const question = questions[index];
    const correctAnswer = answers[index];

    // Use setTimeout to allow the game to visually pause before the prompt blocks
    setTimeout(() => {
        const userAnswer = prompt(question + "\n\nEnter a, b, c, or d:");

        let feedback = "";
        if (userAnswer === null) {
            // User cancelled
             feedback = "Quiz skipped.";
             console.log("Quiz Cancelled");
        } else {
            const cleanedAnswer = userAnswer.trim().toLowerCase();
            if (cleanedAnswer === correctAnswer) {
                score += 1;
                feedback = "Correct!";
                console.log("Correct answer!");
            } else {
                score -= 1;
                if (score < 0) {
                    score = 0; // Score cannot go below 0
                }
                feedback = `Oops! The correct answer was: ${correctAnswer.toUpperCase()}`;
                console.log("Incorrect answer.");
            }
        }

        // Update score display
        scoreText.setText('Score: ' + score);
        console.log("Current Score:", score);

        // Give feedback via alert (after prompt)
        alert(feedback);

        // Resume game
        isRunning = true;
         console.log("Game Resumed");
        // Resume timers
         if (goodItemTimer) goodItemTimer.paused = false;
         if (badItemTimer) badItemTimer.paused = false;

         // Optionally resume all items in groups (they keep their last velocity)
        Phaser.Actions.Call(goodItems.getChildren(), item => item.body.velocity.y = item.body.velocity.y || Phaser.Math.Between(60, 200) ); // Restart movement
        Phaser.Actions.Call(badItems.getChildren(), item => item.body.velocity.y = item.body.velocity.y || Phaser.Math.Between(60, 200) ); // Restart movement


    }, 100); // Small delay before prompt
}