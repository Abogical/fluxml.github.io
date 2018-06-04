(function(obj){

	Object.assign(obj, {Model})

	function Model(editor, result, model){
		this.editor = editor;
		this.result = result;
		this.model = model;

		var scope = this;
		this.editor.setDrawEndCallback(callback.bind(scope))
		
		function callback(image){
			this.findResult(image)
		}
	}

	Model.prototype.findResult = function(image){
		var scope = this;
		var input = this.blackAndWhite(image.data).group(1).group(28).group(28);
		
		var tensor = tf.tensor(input);	
		var output = this.model(tensor);

		output.data().then(function(val){
			(scope.showResult.bind(scope))(val);
		})
	}

	// 28*28*4 rgba Unit8 array into 28*28 grayscale Float32Array 
	Model.prototype.blackAndWhite = function(imageData){
		return (
			(new Float32Array(784)).fill(0.0)
			// .map((_, i)=> transpose(i, 28, 28))
			.map((_, i)=>i)
			.map(i => imageData[i*4])
			.map(invertColor)
			.map(reduceToGrayScale)
		);
	}

	Model.prototype.showResult = function(val){
		this.result.update(val)
	}

})(window)


Float32Array.prototype.group = Array.prototype.group = function group(size){
	return this.reduce((acc, e)=>{
		acc.a.push(e);
		if(acc.a.length == size){
			acc.b.push(acc.a);
			acc.a = []
		}
		return acc
	}, {a:[], b:[]}).b
}