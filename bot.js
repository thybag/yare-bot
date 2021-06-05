/**
 * Run - called each tick on entities
 *
 * Logic flow:
 *  * Decide: The decide method of given drone type is called. 
 *    If conditions are met the action is updated, else it returns false and drone continues on last action
 *    
 *  * Act: the act method then carries out the logic for completing the chosen action.
 *    If the action cannot be completed, it can return an override action to change too.
 *    
 *  * Status: logs current status of each drone
 */
function run(entity) {
	let newAction;
	// Worker action
	if (entity.type == 'worker') {
		if (newAction = decideWorker(entity)) entity.action = newAction;
	}
	// Soldier action
	if (entity.type == 'soldier') {
		if (newAction = decideSoldier(entity)) entity.action = newAction;
	}

	// Carry out action
	let overrideAction = act(entity);

	// If currently set action can no longer be continued, a new action will be returned to swap too
	if (overrideAction) {
		console.log("Action override: " + overrideAction);
		entity.action = overrideAction;	
	}
	
	// Log Status
	entity.status();
}

/**
 * Init entity - new entity has been created
 * Currently this just desigantes the drone as either worker or soldier.
 */
function init(entity) {
	entity.type = (i % 2 === 0) ? 'worker' : 'soldier';
	console.log("New Entity " + entity.type + ' ' + entity.id()) ;
}

/**
 * Act - Carry out choosen action type
 */
function act(entity) {
	// Carry out action based on decision.
	switch (entity.action) {
		case 'defending':
			return act_defending(entity);
		case 'charge':
			return act_charge(entity);
		case 'harvest':
			return act_harvest(entity);
		case 'attack':
			return act_attack(entity);
	}
}

// Charge mode - recharge base to make more
function act_charge(entity) {
	if (!entity.inRangeOfBase()) {
		entity.move(base.position);
		return;
	}
	entity.energize(base);
}

// Harvest mode - go charge from star
function act_harvest(entity) {
	if(!entity.inRangeOfStar()) {
		entity.move(memory['my_star'].position);
		return;
	}
	entity.energize(memory['my_star']);
}

// Attack mode - go fight our enemeys
function act_attack(entity) {
	// fight any enemeys
	if (entity.enemyInSight()) {
		let target = entity.findClosestEnemyInSight();
		if (entity.inRange(target)) {
			entity.energize(target);
			return;
		}
	}
	// Else go for the base!
	if (!entity.inRange(enemy_base)) {
		entity.move(enemy_base.position);
		return;
	}

	entity.energize(enemy_base);
}

// Defend mode - fight off attackers.
function act_defending(entity) {
	// Attack closest in sight enemey.
	// If no targets, go charge
	// If in range, fire, else move towards them.

	let target = entity.findClosestEnemyInSight();
	if (!target) {
		// No more targets, set action to charge
		return 'charge';
	}

	if (entity.inRange(target)) {
		entity.energize(target);
	} else {
		entity.move(target.position);
	}
}

// Deciders
function decideSoldier(entity)
{
	// Attack mode triggered when we have 30 ships
	if (memory['live'] > 30  && entity.isFull()) {
		return 'attack';
	}

	// Else act as worker
	return decideWorker(entity);
}

function decideWorker(entity)
{
	// Defend if attackers seen & we're charged
	if (entity.enemyInSight() && !entity.isEmpty()){
    	return "defending";
   	// Go charge base if full
    } else if (entity.isFull()){
		return "charge";
	// Go havest enegery if empty
	} else if (entity.isEmpty()) {
		return "harvest";
	// No action? fallback to charge
	} else if(!entity.action) {
		return "charge";
	}

	return false;
}



/**
 * Yaro Util Methods
 * Impliment your until logic as
 *
 * init(entity) - called when new enitity is created
 * run(entity) - called each tick on live entities
 * Both are called passed "Entity" wrapper that contains variety of util methods & will store data persistantly.
 * 
 * Additional data points
 * memory['ticks'] - current game tick
 * memory['live'] - current live player entities
 * memory['my_star'] - your star
 */

function Entity(spirit, type = 'drone') {
	// core data
	this.spirit = spirit;
	this.range = 195;

	// Use data
	this.type = type;
	this.action = null;
	this.target = null;
	this.data = {}

	// Run actions for spirit
	this.tick = function (tick){
		run(this, tick);
	}

	// Get current id
	this.id = function() {
		return this.spirit.id;
	}

	// Get current size
	this.size = function() {
		return this.spirit.size;
	}

	// Get current energy
	this.energy = function() {
		return this.spirit.energy;
	}

	// Am i alive?
	this.alive = function() {
		return this.spirit.hp > 0;
	}

	// energize
	this.energize = function(target){
		this.spirit.energize(target);
	}

	// move
	this.move = function(location) {
		this.spirit.move(location);
	}

	// Get distance from target
	this.getDistanceFrom = function(target) {
		return getDistance(this.spirit, target)
	}

	// Get my position
	this.position = function(){
		return this.spirit.position;
	}

	// Find closest friend in sight
	this.findClosestFriendInSight = function() {
		if(this.spirit.sight.friends.length === 0) return false;

		// Get visible & work of distance of each
		return this.spirit.sight.friends.map(name => {
			let spirit = getSpirit(name);
			return {dist: this.getDistanceFrom(spirit), ref: spirit}
		// Find whos closest
		}).reduce((prev, curr) => {
			return prev.dist < curr.dist ? prev : curr;
		}).ref;
	}

	// Can see an enemy
	this.enemyInSight = function() {
		return (this.spirit.sight.enemies.length > 0);
	}

	// Find closest enemy in sight
	this.findClosestEnemyInSight = function() {
		if(this.spirit.sight.enemies.length === 0) return false;

		// Get closest
		// Get visible & work of distance of each
		return this.spirit.sight.enemies.map(name => {
			let spirit = getSpirit(name);
			return {dist: this.getDistanceFrom(spirit), ref: spirit}
		// Find whos closest
		}).reduce((prev, curr) => {
			return prev.dist < curr.dist ? prev : curr;
		}).ref;
	}

	// In charge range of base?
	this.inRangeOfBase = function() {
		return this.inRange(base);
	}

	// In charge range of star?
	this.inRangeOfStar = function() {
		return this.inRange(memory['my_star']);
	}

	// Is thing in charge range?
	this.inRange = function(target) {
		return (this.getDistanceFrom(target) < this.range);
	}

	// Is full
	this.isFull = function() {
		return this.spirit.energy == this.spirit.energy_capacity;
	}

	// Is Empty
	this.isEmpty = function() {
		return this.spirit.energy == 0;
	}

	// Report status to console
	this.status = function() {
		console.log(this.type + '.' +this.spirit.id + ' (Size: '+ this.spirit.size + ', HP: '+this.spirit.hp+', Power: ' +this.spirit.energy+'/'+this.spirit.energy_capacity+') ' + this.action);
	}
}

// Init memory trackers
if(!memory['ticks']) memory['ticks'] = 0;
if(!memory['live']) memory['live'] = 0;
if(!memory['my_star']) memory['my_star'] = (getDistance(base, star_a1c) > getDistance(base, star_zxq)) ? star_zxq : star_a1c;

// Count ticks
memory['ticks']++;

// Get debug totals
total_entities=0;
total_live_entities=0;
total_player_entities=0;
total_player_live_entities=0;
total_enemey_entities=0;
total_enemey_live_entities=0;

// Get quick & dirty counts
Object.values(spirits).forEach(v => {
	total_entities++;

	// Track entities from differnt teams
	if (v.player_id == base.player_id) {
		total_player_entities++;
	} else {
		total_enemey_entities++;
	}

	// Track live from differnt teams
	if (v.hp > 0) {
		total_live_entities++;

		if(v.player_id == base.player_id) {
			total_player_live_entities++;
		} else {
			total_enemey_live_entities++;
		}
	}
});

// Console overview
console.log(`
	Tick ${memory['ticks']}, 
	Total: ${total_live_entities}/${total_entities}, 
	Player:  ${total_player_live_entities}/${total_player_entities},
	Enemies:  ${total_enemey_live_entities}/${total_enemey_entities}
`);

// Save currently live so we can act on it.
memory['live'] = total_player_live_entities;

// Call tick on each player spirit, set up new spirits if they don't yet exist.
for (i=0; i<my_spirits.length; i++) {
	let ent = my_spirits[i];

	// Init new entity
    if (!memory[ent.id]) {
    	memory[ent.id] = new Entity(ent);
    	init(memory[ent.id]);
    }

    // Tick running entities
	if(my_spirits[i].hp != 0){
		memory[ent.id].tick(memory['ticks']);
	} 
}

// Util Methods
function getDistance(a, b)
{
    let xd = Math.pow(a.position[0]-b.position[0],2);
    let yd = Math.pow(a.position[1]-b.position[1],2);
    return Math.sqrt(xd + yd);
}

// Get spirit
function getSpirit(eid) {
	return spirits[eid];
}
