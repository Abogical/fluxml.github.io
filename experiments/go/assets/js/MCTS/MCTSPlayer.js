/**********
===========

Original code at https://github.com/tejank10/AlphaGo.jl

===========
**********/

(function(obj){

obj.MCTS = obj.MCTS || {}
Object.assign(obj.MCTS, {Player})

var MCTS = obj.MCTS;

function Player(network, layer, { num_readouts = 1, two_player_mode = false, resign_threshold = -0.9, board_size = 9, max_game_length}={}){
	this.board_size = board_size;
    this.tau_threshold = two_player_mode ? -1 : (board_size * board_size / 12) / 2 * 2
    this.network = network;
    this.num_readouts = num_readouts;
    this.two_player_mode = two_player_mode;
    this.qs = [];
    this.searches_pi = [];
    this.result = 0;
    this.result_string = "";
    this.root = null
    this.resign_threshold = resign_threshold;
    this.position = null;
    this.max_game_length = max_game_length;
    this.layer = layer
    this.current_readouts = 0;
}

var player = Player.prototype;

player.__init__ = function(pos){

  this.root = new MCTS.Node(pos, {
  	max_game_length: this.max_game_length, 
  	board_size: this.board_size
  });
  this.result = 0
  this.searches_pi = [];
  this.qs = [];
}

player.suggest_move = function(cb){
	// console.log("suggest move")
	this.current_readouts = this.root.N();
	// console.log(cb)
	requestAnimationFrame(() => { this.search_loop.bind(this)(cb)})
}

player.search_loop = function(cb){
	if(this.root.N() >= this.current_readouts + this.num_readouts)
		return cb(this.pick_move());

	this.tree_search();
	this.layer(this.best_n(3));

	var loop = () =>{
		return this.search_loop.bind(this)(cb)
	}
	requestAnimationFrame(loop)
}

player.tree_search = function(parallel_readouts=8){
	var leaves = [];
	var failsafe = 0;

	while (leaves.length < parallel_readouts && failsafe < 2 * parallel_readouts){
	    failsafe += 1
	    var leaf = this.root.select_leaf()
	    
	    // console.log(leaf)
	    if (leaf.is_done()){
	      value = leaf.position.score() > 0 ? 1 : -1
	      leaf.backup_value(value, this.root)
	      continue
	    }
	    leaf.add_virtual_loss(this.root)
	    leaves.push(leaf)
  	}

  	if(leaves.length == 0) return [];

  	// var l = leaves.length;
  	// var p = new Array(p);
  	// for(var i=0; i<l; i++){ p[i] = leaves[i].position}
	var { move_probs, values } = this.network.process(leaves)
	
	var len = this.board_size*this.board_size + 1
	
	move_probs = MCTS.partition(Array.from(move_probs.dataSync()),len);
	values = values.dataSync();
	for (var i in leaves){
		var leaf = leaves[i];
		var move_prob = move_probs[i]
		var value = values[i];
		leaf.revert_virtual_loss(this.root)
		leaf.incorporate_results(move_prob, value, this.root)
	}
	
	return leaves
}

player.get_feats = function(){
	return this.root.position.get_feats();
}

player.best_n = function(n){
	var arr = this.root.child_N.slice();
	var min = Math.min(...arr);
	var best = [];
	for(var i =0; i< n; i++){
		var index = MCTS.argMax(arr);
		best.push(index);
		arr[index] = min;
	}
	return best;
}

player.pick_move = function(){
	var fcoord;
	
	if (this.root.position.n >= this.tau_threshold){
		fcoord = MCTS.argMax(this.root.child_N) + 1;
	}else{
		var cdf = tf.cumsum(tf.tensor(this.root.child_N)).dataSync();
		var n = cdf.slice(-2)[0];
		var o = cdf.length
		for(var i =0; i< o; i++){
			cdf[i] = MCTS.safe_div(cdf[i], n);
		}
		selection = Math.random()
		var m = MCTS.searchsortedfirst(cdf, selection);
		var l = this.board_size* this.board_size;
		m = m == -1 || m >= l ? Math.floor(Math.random()*l): m
		fcoord =  m + 1

	}
	// console.log("fcoord....", fcoord)
	return MCTS.to_obj(fcoord, this.root.position.to_play, this.board_size);
}

player.play_move = function(c){
	// console.log("play", c);
	c = MCTS.to_flat(c, this.board_size);
	if (!this.two_player_mode){
		this.searches_pi.push(
			this.root.children_as_pi(this.root.position.n <= this.tau_threshold))
	}
	this.qs.push(this.root.Q())
	
	this.root = this.root.maybe_add_child(c);
	
	this.position = this.root.position
	this.root.parent.children = {}
	
	return true
}

})(window);