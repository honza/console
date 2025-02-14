import * as _ from 'lodash';
import { K8sResourceKind, k8sList, k8sCreate } from '@console/internal/module/k8s';
import { PipelineModel } from '../../../models';
import { GitImportFormData } from '../import-types';
import { createPipelineResource } from '../../pipelines/pipeline-resource/pipelineResource-utils';

export const getPipelineTemplate = async (runtime: string): Promise<K8sResourceKind> => {
  const templates = await k8sList(PipelineModel, {
    ns: 'openshift',
    labelSelector: { 'pipeline.openshift.io/runtime': runtime },
  });
  return templates && templates[0];
};

export const createGitResource = (url: string, namespace: string, ref: string = 'master') => {
  const params = { url, revision: ref };
  return createPipelineResource(params, 'git', namespace);
};

export const createImageResource = (name: string, namespace: string) => {
  const params = {
    url: `image-registry.openshift-image-registry.svc:5000/${namespace}/${name}`,
  };

  return createPipelineResource(params, 'image', namespace);
};

export const createPipelineForImportFlow = async (formData: GitImportFormData) => {
  const {
    name,
    project: { name: namespace },
    git,
    pipeline,
  } = formData;
  const template = _.cloneDeep(pipeline.template);

  template.metadata = {
    name: `${name}-${template.metadata.name}`,
    namespace,
    labels: template.metadata.labels,
  };

  template.spec.params = template.spec.params.map((param) => {
    if (param.name === 'APP_NAME') {
      param.default = name;
    }

    return param;
  });

  try {
    await createGitResource(git.url, namespace, git.ref);
    await createImageResource(name, namespace);
  } catch (err) {
    throw err;
  }

  return k8sCreate(PipelineModel, template, { ns: namespace });
};
