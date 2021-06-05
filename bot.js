// Config vars

// Switch soldier to attack mode when active unit's 'is above this number
attack_min_size = 30;
// trigger all out attack with every drone
all_for_one_and_one_for_all = false;
// Retreat from attacking if energy is less than
retreat_energy = 3;

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

	// Swap all workers to soldier.
	if (all_for_one_and_one_for_all) {
		entity.type = 'soldier';
	}

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
 * Currently this just designates the drone as either worker or soldier.
 */
function init(entity) {
	entity.type = (i % 2 === 0) ? 'worker' : 'soldier';
	console.log("New Entity " + entity.type + ' ' + entity.id()) ;
}

/**
 * Act - Carry out chosen action type
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
		case 'target':
			return act_target(entity);
		case 'scout':
			return act_scout(entity);
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

	// fight any enemies
	if (entity.enemyInSight()) {
		let target = entity.findClosestEnemyInSight();
		if (entity.inRange(target)) {
			entity.energize(target);
			return;
		}
	}

	// Retreat (go harvest)
	if (entity.energy() < retreat_energy) {
		return 'harvest';
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
	// Attack closest in sight enemy.
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

// Charge mode - recharge base to make more
function act_target(entity) {
	// Return to normal if target is missing/dead
	if (!entity.target || entity.target.hp == 0) {
		entity.target = null;
		return 'charge';
	}

	if (entity.inRange(entity.target)) {
		entity.energize(entity.target);
		return;
	}
	entity.move(entity.target.position);
}

// Scout mode - try and lock down someones base
function act_scout(entity) {
	// Defend itself if someones in range
	if (entity.enemyInSight()) {
		let target = entity.findClosestEnemyInSight();
		if (entity.inRange(target)) {
			entity.energize(target);
			return;
		}
	}

	// Sit just off the side if we can
	let location;

	if (memory['my_star'].id == 'star_a1c') {
		// If lower star, offset to the right
		location = [enemy_base.position[0]+(entity.range*2)-30,enemy_base.position[1]];
	} else {
		// if supper star, offset to the left
		location = [enemy_base.position[0]-(entity.range*2),enemy_base.position[1]];
	}
	
	entity.move(location);

	// Then sit
}

// Deciders
function decideSoldier(entity)
{	
	// If I'm the scout
	// or the scout is not set or dead
	// and i'm full HP - go scout
	if (
		(memory['scout_id'] == entity.id() || !memory['scout_id'] || getSpirit(memory['scout_id']).hp == 0) 
		&& entity.isFull()
	) {
		// Update who the scout is
		memory['scout_id'] = entity.id();
		return 'scout';
	}

	// Attack mode triggered when we have 30 ships
	if (memory['stats'].total_player_live_entities > attack_min_size && entity.isFull()) {
		return 'attack';
	}

	// Detect short game mode. If total_enemey_entities is still 7 when we have 10, assume player is dead & attack
	if (memory['stats'].total_player_live_entities > 10 && memory['stats'].total_enemey_entities == 7 && entity.isFull() ) {
		return 'attack';
	}

	// Chase away anyone locking down the base
	if (base.sight.enemies.length > 0) {
		entity.target = getSpirit(base.sight.enemies[0]);
		return 'target';
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


// Default scout
if(!memory['scout_id']) memory['scout_id'] = null;

/**
 * Yare.io Util Methods
 * Implement your until logic as
 *
 * init(entity) - called when new enitity is created
 * run(entity) - called each tick on live entities
 * Both are called passed "Entity" wrapper that contains variety of util methods & will store data persistantly.
 * 
 * Additional data points
 * memory['ticks'] - current game tick
 * memory['stats'] - Figures such as total_player_live_entities
 * memory['my_star'] - your star
 */

function Entity(spirit, type = 'drone') {
	// core data
	this.spirit = spirit;
	this.range = 196;

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

	// Get HP
	this.hp = function() {
		return this.spirit.hp;
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
if(!memory['my_star']) memory['my_star'] = (getDistance(base, star_a1c) > getDistance(base, star_zxq)) ? star_zxq : star_a1c;
stats = {
	total_entities:0,
	total_live_entities:0,
	total_player_entities:0,
	total_player_live_entities:0,
	total_enemey_entities:0,
	total_enemey_live_entities:0
};

// Count ticks
memory['ticks']++;

// Get quick & dirty counts
Object.values(spirits).forEach(v => {
	stats.total_entities++;

	// Track entities from differnt teams
	if (v.player_id == base.player_id) {
		stats.total_player_entities++;
	} else {
		stats.total_enemey_entities++;
	}

	// Track live from different teams
	if (v.hp > 0) {
		stats.total_live_entities++;

		if(v.player_id == base.player_id) {
			stats.total_player_live_entities++;
		} else {
			stats.total_enemey_live_entities++;
		}
	}
});

memory['stats'] = stats;

// Console overview
console.log(`
	Tick ${memory['ticks']}, 
	Player:  ${memory['stats'].total_player_live_entities}/${memory['stats'].total_player_entities},
	Enemies:  ${memory['stats'].total_enemey_live_entities}/${memory['stats'].total_enemey_entities}
	Total: ${memory['stats'].total_live_entities}/${memory['stats'].total_entities}, 
`);

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
