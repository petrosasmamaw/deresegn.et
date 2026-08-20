import { Component } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { logger } from '../lib/logger'

/**
 * Catches render/runtime errors anywhere below it so a single component crash
 * shows a recovery screen instead of a white screen or a hard native crash.
 * "Try again" clears the error and re-mounts the tree.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Something went wrong' }
  }

  componentDidCatch(error, info) {
    logger.error('Unhandled UI error', {
      message: error?.message,
      stack: error?.stack,
      componentStack: info?.componentStack,
    })
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            The app hit an unexpected error. You can try again — your session is safe.
          </Text>
          {__DEV__ && this.state.message ? (
            <Text style={styles.detail}>{this.state.message}</Text>
          ) : null}
          <Pressable style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </ScrollView>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4EEDC',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B463A',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(14, 36, 32, 0.68)',
    textAlign: 'center',
    marginBottom: 20,
  },
  detail: {
    fontSize: 12,
    color: '#b3261e',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#1B463A',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  buttonText: {
    color: '#F4EEDC',
    fontSize: 15,
    fontWeight: '600',
  },
})
