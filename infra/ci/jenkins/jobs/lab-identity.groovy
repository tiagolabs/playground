pipelineJob('lab-identity-worktree') {
  description('Build and test the current lab-identity worktree without committing or deploying.')
  definition { cps {
    script('''pipeline {
      agent { label 'wsl-local' }
      stages {
        stage('Build and test') { steps { sh '"$LAB_SOURCE_REPO/infra/pipelines/lab-identity/build.sh"' } }
      }
    }''')
    sandbox()
  } }
}
pipelineJob('lab-identity-deploy') {
  description('Explicit promotion of locally tested Lab Identity images to cluster-lab.')
  definition { cps {
    script('''pipeline {
      agent { label 'wsl-local' }
      stages {
        stage('Build and test') { steps { sh '"$LAB_SOURCE_REPO/infra/pipelines/lab-identity/build.sh"' } }
        stage('Deploy') { steps { sh '"$LAB_SOURCE_REPO/infra/pipelines/lab-identity/deploy.sh"' } }
      }
    }''')
    sandbox()
  } }
}
