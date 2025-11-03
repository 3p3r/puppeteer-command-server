//go:build darwin
// +build darwin

package main

import _ "embed"

//go:embed build/mac/pcs
var embeddedBinary []byte

