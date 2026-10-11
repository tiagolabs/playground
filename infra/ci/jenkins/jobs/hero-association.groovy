def services = ['core', 'bff', 'expedition', 'market', 'assets', 'world', 'quest', 'frontend']
services.each { service ->
  def worktreeScript = '''
    pipeline {
      agent { label 'wsl-local' }
      options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
        timeout(time: 3, unit: 'HOURS')
      }
      stages {
        stage('Build and verify worktree service') {
          steps {
            deleteDir()
            sh 'bash "$LAB_SOURCE_REPO/infra/pipelines/hero-association/jenkins/run-service-build.sh" worktree __SERVICE__'
          }
        }
      }
      post {
        always { archiveArtifacts artifacts: 'artifact-id.txt,evidence/*', allowEmptyArchive: true }
      }
    }
  '''.replace('__SERVICE__', service)
  pipelineJob("hero-association-" + service + "-build-worktree") {
    description("Manual: build " + service + " from a local worktree snapshot and verify its eight-image archive; no deployment.")
    definition { cps { script(worktreeScript); sandbox() } }
  }

  def deployScript = '''
    pipeline {
      agent { label 'wsl-local' }
      options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
        timeout(time: 1, unit: 'HOURS')
      }
      parameters { string(name: 'ARTIFACT_ID', defaultValue: '', description: 'Verified service artifact ID from a build job') }
      stages {
        stage('Deploy verified service artifact to k3d') {
          steps {
            deleteDir()
            sh 'bash "$LAB_SOURCE_REPO/infra/pipelines/hero-association/jenkins/run-service-deploy.sh" __SERVICE__ "$ARTIFACT_ID"'
          }
        }
      }
      post {
        always { archiveArtifacts artifacts: 'evidence/*', allowEmptyArchive: true }
      }
    }
  '''.replace('__SERVICE__', service)
  pipelineJob("hero-association-" + service + "-deploy-local") {
    description("Deploy an already verified " + service + " artifact to the local k3d cluster without rebuilding.")
    parameters { stringParam("ARTIFACT_ID", "", "Verified service artifact ID") }
    definition { cps { script(deployScript); sandbox() } }
  }

  def mainScript = '''
    pipeline {
      agent none
      options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
        timeout(time: 3, unit: 'HOURS')
      }
      stages {
        stage('Build and verify trusted main') {
          steps {
            script {
              lock(resource: 'hero-association-main-promotion') {
                node('wsl-local') {
                  deleteDir()
                  git branch: 'main', url: 'https://github.com/tiago-vibes-on/hands-on.git', poll: false
                  if (fileExists('infra/pipelines/hero-association/jenkins/run-service-build.sh')) {
                    try {
                      sh 'bash infra/pipelines/hero-association/jenkins/run-service-build.sh main __SERVICE__'
                    } finally {
                      archiveArtifacts artifacts: 'artifact-id.txt,evidence/*', allowEmptyArchive: true
                    }
                  } else {
                    echo 'Service jobs are not on main yet; no build.'
                  }
                }
              }
            }
          }
        }
      }
    }
  '''.replace('__SERVICE__', service)
  pipelineJob("hero-association-" + service + "-build-main") {
    description("Manual: build and verify trusted main for " + service + "; deployment is separate.")
    definition { cps { script(mainScript); sandbox() } }
  }
}
pipelineJob('hero-association-k3d') {
  disabled(true)
  description('Legacy full-stack job; replaced by service jobs.')
}
pipelineJob('hero-association-precommit') {
  disabled(true)
  description('Legacy full-stack precommit job; replaced by service jobs.')
}
