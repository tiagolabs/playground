pipelineJob('lab-identity-worktree') {
  description('Build and test the current lab-identity worktree without committing or deploying.')
  definition { cps {
    script('''pipeline {
      agent { label 'wsl-local' }
      options { disableConcurrentBuilds() }
      stages {
        stage('Build and test') { steps { sh '"$LAB_SOURCE_REPO/infra/pipelines/lab-identity/build.sh"' } }
      }
    }''')
    sandbox()
  } }
}
pipelineJob('lab-identity-deploy') {
  description('Promote an existing verified Lab Identity candidate without rebuilding it.')
  parameters { stringParam('CANDIDATE_ID', '', 'Required ID from a successful lab-identity-worktree build.') }
  definition { cps {
    script('''pipeline {
      agent { label 'wsl-local' }
      options { disableConcurrentBuilds() }
      stages {
        stage('Promote candidate') { steps { sh '"$LAB_SOURCE_REPO/infra/pipelines/lab-identity/deploy.sh" "$CANDIDATE_ID"' } }
      }
    }''')
    sandbox()
  } }
}
pipelineJob('lab-identity-rollback') {
  description('Restore the previous successful Lab Identity candidate from its retained archive.')
  definition { cps {
    script('''pipeline {
      agent { label 'wsl-local' }
      options { disableConcurrentBuilds() }
      stages {
        stage('Restore candidate') { steps { sh '"$LAB_SOURCE_REPO/infra/pipelines/lab-identity/deploy.sh" rollback' } }
      }
    }''')
    sandbox()
  } }
}
