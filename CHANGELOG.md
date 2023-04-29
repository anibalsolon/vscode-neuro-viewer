# Change Log
### [0.0.15]

* added DCM support

### [0.0.14]

* Better support for code-server, thanks to [@TinasheMTapera](https://github.com/TinasheMTapera) for input
* Fix image loading when the affine is zeroed, thanks to [@nx10](https://github.com/nx10) and [@pierre-nedelec](https://github.com/pierre-nedelec) for helping debugging it
* Fix file access when running on Windows, thanks to [@nx10](https://github.com/nx10) for providing with a fix for it

### [0.0.13]

* Adjusts colors for high contrast themes
* Reintroduces loading message for web extension

### [0.0.12]

* Introduces web-extension
* Fixes related to VSCode theme color, thanks to [@astewartau](https://github.com/astewartau) report
* Fixes image orientation, computing from affine
* Fixes geometry string to look more like AFNI

### [0.0.11]

* Introduces color palletes
* Introduces palette color range in histogram
* Fixes color for negative values, thanks to [@Linus4world](https://github.com/Linus4world) report
* Rewrites webview code in TypeScript
* Modularizes code

### [0.0.10]

* Introduces histogram
* Introduces highlighting

### [0.0.9]

* No change, just house cleaning.

### [0.0.8]

* No change, just house cleaning.

### [0.0.7]

* Nifti loading overhaul- remove nifti-reader-js and use optimized and type-safe methods. Use streams to serve data, instead of loading the whole file in memory.
* Add volume to endpoint, allowing to future fMRI support.
* Add unit tests.
* Small UI fixes.

### [0.0.6]

* Add slice slider + thumbnail, axis selector, and reworking to allow different data orientations.

### [0.0.5]

* Icon and some metadata. Keep it pretty!

### [0.0.4]

* Update release notes!
* Add loading message.

### [0.0.3]

* Code organizing;
* Preprocessing images on loading;
* Handling different pixel resolutions.

### [0.0.2]

* Some metadata updates.

### [0.0.1]

* New extension on the block.
