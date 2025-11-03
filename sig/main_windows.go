//go:build windows
// +build windows

package main

import _ "embed"

//go:embed build/win/pcs.exe
var embeddedBinary []byte

