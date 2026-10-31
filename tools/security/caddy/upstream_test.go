package main

// Keep upstream test-only dependencies in the disposable vendor tree so its
// regression suite uses the same selected module versions as the proxy build.
import (
	_ "github.com/google/go-cmp/cmp"
	_ "github.com/stretchr/testify/assert"
	_ "github.com/stretchr/testify/require"
)
