package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"syscall"
)

// embeddedBinary is defined in platform-specific files:
// - main_linux.go for Linux
// - main_darwin.go for macOS
// - main_windows.go for Windows

func main() {
	// Check platform support
	if runtime.GOOS != "linux" && runtime.GOOS != "darwin" && runtime.GOOS != "windows" {
		fmt.Fprintf(os.Stderr, "Unsupported platform: %s\n", runtime.GOOS)
		os.Exit(1)
	}

	if len(embeddedBinary) == 0 {
		fmt.Fprintf(os.Stderr, "No binary embedded for platform: %s\n", runtime.GOOS)
		os.Exit(1)
	}

	// Create a unique temporary file with appropriate extension
	var tmpFilePath string
	var tmpFile *os.File
	var err error
	if runtime.GOOS == "windows" {
		tmpFile, err = os.CreateTemp("", "pcs-*.exe")
	} else {
		tmpFile, err = os.CreateTemp("", "pcs-*")
	}
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create temporary file: %v\n", err)
		os.Exit(1)
	}
	// todo: check cleanup ?
	tmpFilePath = tmpFile.Name()
	tmpFile.Close()

	// Write embedded binary to temp file
	err = os.WriteFile(tmpFilePath, embeddedBinary, 0755)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to write temporary binary: %v\n", err)
		os.Exit(1)
	}

	// Ensure the file has execute permissions
	err = os.Chmod(tmpFilePath, 0755)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to set execute permissions: %v\n", err)
		os.Exit(1)
	}

	// Cleanup function
	cleanup := func() {
		os.Remove(tmpFilePath)
	}

	// Setup signal handling for cleanup
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigChan
		cleanup()
		os.Exit(1)
	}()

	// Defer cleanup on normal exit
	defer cleanup()

	// Execute the binary with all passed arguments
	ctx := context.Background()
	cmd := exec.CommandContext(ctx, tmpFilePath, os.Args[1:]...)
	
	// Pass through stdin, stdout, stderr
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	// Run the command
	err = cmd.Run()
	if err != nil {
		// If the command exits with an error, capture the exit code
		if exitError, ok := err.(*exec.ExitError); ok {
			os.Exit(exitError.ExitCode())
		}
		fmt.Fprintf(os.Stderr, "Failed to execute binary: %v\n", err)
		os.Exit(1)
	}
}

