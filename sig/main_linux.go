//go:build linux
// +build linux

package main

import _ "embed"

//go:embed build/linux/pcs
var embeddedBinary []byte

