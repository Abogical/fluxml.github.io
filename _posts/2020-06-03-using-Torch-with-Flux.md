# Using Torch kernels inside Flux.jl

With [Flux.jl](https://github.com/Flux/Flux.jl), we have demonstrated how we see a high performance and flexible [differentiable programming](./2019-03-05-dp-vs-rl.md) framework to look like and show its intended use cases to be far reaching and allowing for meaningful speedups. We use it to target highly specialised hardware accelerators like [GPUs](https://fluxml.ai/Flux.jl/stable/gpu/) or [TPUs](https://arxiv.org/pdf/1810.09868.pdf). In our framework, we expect to use as much of the Julia ecosystem, and play nicely with custom types that our users define.

In that spirit, we introduce [Torch.jl](https://github.com/FluxML/Torch.jl), a package that wraps the optimised kernels written for torch and PyTorch, and makes them available to use through Julia. We expect to do this to gain coverage over our existing GPU stack, and bring us plenty of performance improvements on GPUs along the way. As an example we take a popular object detection model - ResNet50 - and compare it with our existing tooling.

![img](https://user-images.githubusercontent.com/20618666/79492160-e60a5600-801f-11ea-9d7f-dd04af243e44.png)
*Image by github user https://github.com/gartangh*

Not too shabby, we see about 2 orders of magnitude worth of improvement in runtime over the native kernels (all packages make use of the optimised cudnn kernels where possible). We however, see some areas of pending improvement, one of them being memory management. This is one of the areas which we intend to improve upon, to remove the area of majority of overhead. 

## Usage

Adding the package using the Pkg, Julia's package manager is easy. However, note that at the time of writing, Torch.jl assumes the presence of a CUDA enabled GPU on the device its being added to, and assumes linux as the OS.

```julia
# Type `]` to enter Pkg mode in the Julia REPL.
pkg> add Torch
[...] # Note that this downloads the Torch artifact, which is quite large

julia> using Torch
```

Once it has been installed, we can talk about the different functions that Torch.jl makes available.

In addition, we expect to make as few but relevant assumptions about the kind of models that the ML community has been developing, and how we see their use grow in more fields than ever before, which is why we want these `Tensor`s to mimic Julia arrays closely

Torch.jl provides the `Tensor` type which closely follows the semantics of a regular Julia array, albeit being managed by torch. One can create a tensor with an API similar to `rand` or `zeros` etc.

```julia
julia> z = Tensor(3,3)
3×3 Tensor{Float32,2} :
 0.0  0.0  0.0
 0.0  0.0  0.0
 0.0  0.0  0.0
```

To control the device the tensor is loaded on (the default being on CPU), we use the `dev` keyword, available in most functions.

```julia
julia> z = Tensor(3,3, dev = 0)
3×3 Tensor{Float32,2} :
 0.0  0.0  0.0
 0.0  0.0  0.0
 0.0  0.0  0.0
```

Note that setting `dev` to `-1` implies the CPU, and `[0,...]` represent the id of the GPU we intend to load the tensor on. The default GPU is assumed to be `0`, for functions revelant to moving these tensors around. Torch.jl also emits the `torch` function which behaves like the `gpu` function already in Flux, instead moving over structs to Torch instead of CUDA.

```julia
julia> using Flux, Metalhead, Torch

julia> using Torch: torch

julia> resnet = ResNet() # from Metalhead
ResNet()

julia> tresnet = resnet |> torch
ResNet()
```

We can verify that that in fact moved our parameters of the model over to Torch by checking out the `params`.

```julia
julia> typeof.(Flux.params(tresnet))
212-element Array{DataType,1}:
 Tensor{Float32,4}
 Tensor{Float32,1}
[...]
```

It is also possible to move regular Julia arrays to and from torch using the `tensor` helper function.

```julia
julia> r = rand(Float32, 3,3)
3×3 Array{Float32,2}:
 0.435017  0.287086  0.105608
 0.636305  0.398222  0.0682819
 0.74551   0.944293  0.387852

julia> tr = tensor(r, dev = 0) # 0 => GPU:0
3×3 Tensor {Float32,2}:
 0.435017  0.287086  0.105608
 0.636305  0.398222  0.0682819
 0.74551   0.944293  0.387852

julia> collect(tr)
3×3 Array{Float32,2}:
 0.435017  0.287086  0.105608
 0.636305  0.398222  0.0682819
 0.74551   0.944293  0.387852
```

## Taking gradients

Our tooling's flexible approach means it is indeed possible to use our reverse-mode AD [Zygote.jl](https://github.com/Flux/Zygote.jl) to differentiate the models including these tensors as we would our regular `Array`s.

```julia
julia> ip = rand(Float32, 224, 224, 3, 1);

julia> tip = tensor(ip, dev = 0);

julia> gs = gradient(Flux.params(tresnet)) do
         sum(tresnet(tip))
       end;
```

We can now use these gradient to train our models.

## Additional Remarks

With Torch, we expand the coverage of our GPU stack even further, and provide the tools that allow users to solve interesting problems with the performance in tow.

In Torch.jl, our aim is also to change as little user code as possible, making it easy to get started with. We further plan to integrate more kernels and provide features from Torch that our users would be interested in. For feature requests and issues you might have using Torch, since the package is fairly new, please open issues on our [GitHub issue tracker](https://github.com/Flux/Torch.jl/issues). We would also appreicate contributions via pull requests to the same repository.

Looking forward to seeing folks make use of it. Cheers!