// Config vars

// Switch soldier to attack mode when active unit's 'is above this number
attack_min_size = 30;
// trigger all out attack with every drone
all_for_one_and_one_for_all = false;
// Retreat from attacking if energy is less than
retreat_energy = 3;
// Amount of scouts to keep harassing enemy
scout_count = 1;
// Make scouts attack
scout_attack = false;
// make scouts merge when they reach final location
merge_scouts = false;
// Scout run
scout_run = false;
// Defend the base
hold_the_line = false;

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
		case 'chain':
			return act_chain_chargers(entity);
		case 'base':
			return act_base_defence(entity);
	}
}

function act_chain_chargers(entity) {

	let placement = getChainPlacement();
	entity.role = placement.role;

	// Move to target position
	if (!positionsMatch(entity.position(), placement.position)) {
		entity.move(placement.position);
	}

	// Note:
	// isFull & energize maintain a prediected charge for each spirit.
	// this should mean everything with avoid overcharging where possible by default

	// Collect enegry from sun & give it to linkers!
	if (entity.role == 'havester') {
		// If in range of the base, charge it directly
		if (entity.inRangeOfBase()) return entity.energize(base);

		// Else if i have space, charge my self up
		if (entity.inRangeOfStar() && !entity.isFull()) { // isFull
			// If in range start charging
			entity.energize(memory['my_star']);
		} else {
			// If i don't pass it on
			let friend = findChainChargeTarget(entity, 'linker');
			if (friend) entity.energize(friend);
		}
	}

	// Get power to the feeders
	if (entity.role == 'linker') {
		// If in range of the base, charge it directly
		if (entity.inRangeOfBase()) return entity.energize(base);

 		// Else find someone to pass charge on too
		let friend = findChainChargeTarget(entity, 'feeder');
		if (friend) entity.energize(friend);
	}

	// Feed the beast!
	if (entity.role == 'feeder') {
		// Try and get charge in the base
		if (entity.inRangeOfBase()) entity.energize(base);
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
		return 'harvest';
	}

	if (entity.inRange(target)) {
		entity.energize(target);
	} else {
		entity.move(target.position);
	}
}

// Defend mode - fight off attackers.
function act_base_defence(entity) {
	// Attack closest in sight enemy.
	// If no targets, go charge
	// If in range, fire, else move towards them.

	let target = entity.findClosestEnemyInSight();
	if (target) {
		if (entity.inRange(target)) {
			entity.energize(target);
		}
	}

	// Head to the base
	entity.move(base.position);
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
	}
	entity.move(entity.target.position);
}

// Scout mode - try and lock down someones base
function act_scout(entity) {

	// Scout war
	if (scout_attack) {
		// Act as attacker
		act_attack(entity);
		return;
	}

	// Go recharge
	if (scout_run) {
		act_harvest(entity)
		return;
	}

	if (entity.isEmpty()) {
		// @todo remove self from scout list
		return 'harvest';
	}

	// Defend itself if someones in range
	if (entity.enemyInSight()) {
		let target = entity.findClosestEnemyInSight();
		if (entity.inRange(target)) {
			entity.energize(target);
		}
	}

	// Sit just off the side if we can
	let location;

	if (memory['my_star'].id == 'star_a1c') {
		// If lower star, offset to the right
		location = [enemy_base.position[0]+(entity.range*2)-60,enemy_base.position[1]-200];
	} else {
		// if upper star, offset to the left
		location = [enemy_base.position[0]-(entity.range*2)+50,enemy_base.position[1]+200];
	}

	if (!positionsMatch(location, entity.position())) {
		entity.move(location);
	} else {
		if (!merge_scouts) return;
		// Form up
		let f = entity.findClosestFriendInSight();
		if (f && entity.inRange(f)) {
			entity.spirit.merge(f);
		}
	}
}

/** 
 *  UNIT TYPE deciders.
 *  - Soldier logic
 *  - Worker logic
 * 
 * @param  {[type]} entity [description]
 * @return {[type]}        [description]
 */
function decideSoldier(entity)
{
	// Check we have a scout, else become them if i'm full
	if ((!memory['scout_ids'] || memory['scout_ids'].length < scout_count) && entity.isFull()){
		// Update who the scout is
		memory['scout_ids'].push(entity.id());
	}

	// If I'm the scout
	if (memory['scout_ids'].includes(entity.id())) {
		return 'scout';
	}

	// Defencive mode
	if(hold_the_line) return 'base';

	// Attack mode triggered when we have 30 ships
	if (memory['stats'].total_player_live_entities > attack_min_size) {
		return 'attack';
	}

	// Detect short game mode. If total_enemey_entities is still 7 when we have 10, assume player is dead & attack
	if (memory['stats'].total_player_live_entities > 10 && memory['stats'].total_enemey_entities == 7) {
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
	// Defencive mode
	if(hold_the_line) return 'base';

	if (entity.enemyInSight() && !entity.isEmpty()) {
		// Go charge base if full
    	return "defending";
    } else {
    	return 'chain';
    }

    // Fallback
	if (!entity.action) {
		return "chain";
	}

	return false;
}

function decideLegacyWorker(entity)
{
	// Defend if attackers seen & we're charged
	if (entity.enemyInSight() && !entity.isEmpty()){
    	return "defending";
   	// Go charge base if full
    } else if (entity.isFull()){
		return "charge";
	// Go harvest energy if empty
	} else if (entity.isEmpty()) {
		return "harvest";
	// No action? fallback to charge
	} else if(!entity.action) {
		return "charge";
	}

	return false;
}

// Default scout
if(!memory['scout_ids']) memory['scout_ids'] = [];
// Clean out dead scouts.
memory['scout_ids'] = memory['scout_ids'].filter(s => getSpirit(s).hp != 0);

// Calculate chain
// 2 1 1



	// Find entities with a given role that are not yet full.
function findChainChargeTarget(entity, role) {
	if(entity.spirit.sight.friends.length === 0) return false;

	// Get visible & work of distance of each
	let potentials = entity.spirit.sight.friends
	.filter(name => {
		let ent = getEntity(name);
		return (ent && !ent.isFull() && ent.role == role);
	});

	if(potentials.length == 0) return false;

	return potentials.map(name => {
		let spirit = getSpirit(name);
		return {dist: entity.getDistanceFrom(spirit), ref: spirit}
	// Find whos closest
	}).reduce((prev, curr) => {
		return prev.dist < curr.dist ? prev : curr;
	}).ref;
}


/**
 * Yare.io Util Methods
 * Implement your until logic as
 *
 * init(entity) - called when new enitity is created
 * run(entity) - called each tick on live entities
 * Both are called passed "Entity" wrapper that contains variety of util methods & will store data persistently.
 * 
 * Additional data points
 * memory['ticks'] - current game tick
 * memory['stats'] - Figures such as total_player_live_entities
 * memory['my_star'] - your star
 */

function Entity(spirit, type = 'drone') {
	// core data
	this.spirit = spirit;
	this.range = 198;

	// Use data
	this.type = type;
	this.action = null;
	this.target = null;
	this.role = null;

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
		// Apply predicted damage so we know if its worth attacking
		if (memory['sprite_power_map'][target.id]) {
			// apply prediected power cost
			memory['sprite_power_map'][this.id()] -= this.size(); 

			// If charging, apply additional power
			if (target.player_id == base.player_id) {
				memory['sprite_power_map'][target.id] += this.size();
			} else {
				// apply predicted damage
				memory['sprite_power_map'][target.id] -= this.size() * 2; 
			}
		}

		this.spirit.energize(target);
	}

	// Is full
	this.isFull = function(predicted = true) {
		if (predicted) return memory['sprite_power_map'][this.id()] == this.spirit.energy_capacity;

		return this.spirit.energy == this.spirit.energy_capacity;
	}

	// Is Empty
	this.isEmpty = function(predicted = true) {
		if (predicted) return memory['sprite_power_map'][this.id()] == 0;

		return this.spirit.energy == 0;
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

	// Merge
	this.merge = function(target) {
		this.spirit.merge(target);
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
		// No one in sight
		if(this.spirit.sight.enemies.length === 0) return false;

		// Get closest valid target within sight
		let results = this.spirit.sight.enemies
			// Only include sprites we consider to be still alive (no point killing em twice)
			.filter(name => {
				return memory['sprite_power_map'][name] > -1;
			})
			// Get spirit distance so we target nearest first.
			.map(name => {
				let spirit = getSpirit(name);
				return {
					dist: this.getDistanceFrom(spirit),
					ref: spirit
				}
			});

		if(results.length == 0) return false;

		// If we have a valid target, get our closest friend
		return results.reduce((prev, curr) => {
			return prev.dist < curr.dist ? prev : curr;
		})
		.ref;
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

	// Report status to console
	this.status = function() {
		console.log(this.type + '.' +this.spirit.id + ' (Size: '+ this.spirit.size + ', HP: '+this.spirit.hp+', Power: ' +this.spirit.energy+'/'+this.spirit.energy_capacity+') ' + this.action + '.' + this.role);
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
sprite_power_map = {}; 

// Get quick & dirty counts
Object.values(spirits).forEach(v => {
	stats.total_entities++;
	sprite_power_map[v.id] = v.energy;

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
// Use to count out dmg applied over tick
// So we don't keep fireing at enemeys we already killed
memory['sprite_power_map'] = sprite_power_map;

//if(!memory['charge_chain_setup']) {
	memory['charge_chain_setup'] = [
		{role:'havester', position: positionOnLine(memory['my_star'], base, -195)},
		{role:'linker', position: positionOnLine(memory['my_star'], base, -340)},
		{role:'feeder', position: positionOnLine(memory['my_star'], base, -520)}
	];
//}

chain_count=1;

function getChainPlacement() {
	
	let pos = chain_count % 4;
	chain_count++;
 
 	if (pos <= 1) {
 		return memory['charge_chain_setup'][0];
 	}
 	if (pos == 2) {
 		return memory['charge_chain_setup'][1];
 	}
 	if (pos == 3) {
 		return memory['charge_chain_setup'][2];
 	}
 	
}

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

console.log(memory['sprite_power_map']);


function positionsMatch(a, b){
	if(!a || !b) return false;
	return (Math.round(a[0]) == Math.round(b[0]) && Math.round(a[1]) == Math.round(b[1]));
}

function positionOnLine(a, b, distance)
{	
	let xd = a.position[0]-b.position[0];
    let yd = a.position[1]-b.position[1];
    let line_dist = Math.sqrt(Math.pow(xd,2) + Math.pow(yd,2));

    let proportion = distance / line_dist;

    return [
    	a.position[0] + (xd * proportion),
  	 	a.position[1] + (yd * proportion)
   ]
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
function getEntity(eid) {
	return memory[eid];
}
