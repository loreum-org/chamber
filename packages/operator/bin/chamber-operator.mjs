#!/usr/bin/env node
import { register } from 'tsx/esm/api'

register()
await import(new URL('../src/cli.ts', import.meta.url))
