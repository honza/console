import * as React from 'react';
import * as _ from 'lodash';
import * as classNames from 'classnames';
import { connect } from 'react-redux';
import {
  Table,
  TableHeader,
  TableBody,
  TableVariant,
  TableGridBreakpoint,
} from '@patternfly/react-table';
import { getInfrastructurePlatform, getName, getNodeRoles } from '@console/shared';
import { tableFilters } from '@console/internal/components/factory/table-filters';
import { ActionGroup, Button } from '@patternfly/react-core';
import { ButtonBar } from '@console/internal/components/utils/button-bar';
import { history } from '@console/internal/components/utils/router';
import {
  convertToBaseValue,
  humanizeCpuCores,
  humanizeBinaryBytes,
  ResourceLink,
} from '@console/internal/components/utils/index';
import {
  k8sCreate,
  k8sPatch,
  k8sGet,
  K8sResourceKind,
  k8sList,
  NodeKind,
  referenceForModel,
  StorageClassResourceKind,
  Taint,
} from '@console/internal/module/k8s';
import { NodeModel, InfrastructureModel, StorageClassModel } from '@console/internal/models';
import { isDefaultClass } from '@console/internal/components/storage-class';
import { OCSServiceModel } from '../../models';
import {
  infraProvisionerMap,
  minSelectedNode,
  ocsRequestData,
  ocsTaint,
} from '../../constants/ocs-install';

import './ocs-install.scss';

const ocsLabel = 'cluster.ocs.openshift.io/openshift-storage';

const getConvertedUnits = (value: string) => {
  return humanizeBinaryBytes(convertToBaseValue(value)).string || '-';
};

const tableColumnClasses = [
  classNames('col-md-1', 'col-sm-1', 'col-xs-1'),
  classNames('col-md-4', 'col-sm-8', 'col-xs-11'),
  classNames('col-md-2', 'col-sm-3', 'hidden-xs'),
  classNames('col-md-2', 'hidden-sm', 'hidden-xs'),
  classNames('col-md-1', 'hidden-sm', 'hidden-xs'),
  classNames('col-md-2', 'hidden-sm', 'hidden-xs'),
];

const getColumns = () => {
  return [
    {
      title: 'Name',
      props: { className: tableColumnClasses[1] },
    },
    {
      title: 'Role',
      props: { className: tableColumnClasses[2] },
    },
    {
      title: 'Location',
      props: { className: tableColumnClasses[3] },
    },
    {
      title: 'CPU',
      props: { className: tableColumnClasses[4] },
    },
    {
      title: 'Memory',
      props: { className: tableColumnClasses[5] },
    },
  ];
};

const hasTaints = (node: NodeKind) => {
  return !_.isEmpty(node.spec.taints);
};

const hasOCSTaint = (node: NodeKind) => {
  const taints: Taint[] = node.spec.taints || [];
  return taints.some((taint: Taint) => _.isEqual(taint, ocsTaint));
};

// return an empty array when there is no data
const getRows = (nodes: NodeKind[]) => {
  return nodes
    .filter((node) => hasOCSTaint(node) || !hasTaints(node))
    .map((node) => {
      const roles = getNodeRoles(node).sort();
      const cells = [
        {
          title: <ResourceLink kind="Node" name={node.metadata.name} title={node.metadata.uid} />,
        },
        {
          title: roles.join(', ') || '-',
        },
        {
          title: _.get(node.metadata.labels, 'failure-domain.beta.kubernetes.io/zone') || '-',
        },
        {
          title: `${humanizeCpuCores(_.get(node.status, 'capacity.cpu')).string || '-'}`,
        },
        {
          title: `${getConvertedUnits(_.get(node.status, 'allocatable.memory'))}`,
        },
      ];
      const obj = {
        cells,
        selected: false,
        id: node.metadata.name,
        metadata: _.clone(node.metadata),
        spec: _.clone(node.spec),
      };

      return obj;
    });
};

const getFilteredRows = (filters: {}, objects: any[]) => {
  if (_.isEmpty(filters)) {
    return objects;
  }

  let filteredObjects = objects;
  _.each(filters, (value, name) => {
    const filter = tableFilters[name];
    if (_.isFunction(filter)) {
      filteredObjects = _.filter(filteredObjects, (o) => filter(value, o));
    }
  });

  return filteredObjects;
};

const getPreSelectedNodes = (nodes: formattedNodeType[]) => {
  return nodes.map((node) => ({
    ...node,
    selected: _.has(node, ['metadata', 'labels', ocsLabel]),
  }));
};

const stateToProps = (obj, { data = [], filters = {}, staticFilters = [{}] }) => {
  const allFilters = staticFilters ? Object.assign({}, filters, ...staticFilters) : filters;
  const newData = getFilteredRows(allFilters, data);
  return {
    data: newData,
    unfilteredData: data,
    isFiltered: !!_.get(filters, 'name'),
  };
};
const CustomNodeTable: React.FC<CustomNodeTableProps> = ({
  data,
  unfilteredData,
  isFiltered,
  loaded,
  ocsProps,
}) => {
  const columns = getColumns();
  const [nodes, setNodes] = React.useState([]);
  const [unfilteredNodes, setUnfilteredNodes] = React.useState([]);
  const [error, setError] = React.useState('');
  const [inProgress, setProgress] = React.useState(false);
  const [selectedNodesCnt, setSelectedNodesCnt] = React.useState(0);

  let storageClass = '';

  // pre-selection of nodes
  if (loaded && !unfilteredNodes.length) {
    const formattedNodes: formattedNodeType[] = getRows(unfilteredData);
    const preSelectedNodes = getPreSelectedNodes(formattedNodes);
    setUnfilteredNodes(preSelectedNodes);
    setNodes(preSelectedNodes);
  }

  React.useEffect(() => {
    const selectedNode = _.filter(unfilteredNodes, 'selected').length;
    setSelectedNodesCnt(selectedNode);

    if (isFiltered || nodes.length !== data.length) {
      const unfilteredNodesByID = _.keyBy(unfilteredNodes, 'metadata.name');
      const filterData = _.each(getRows(data), (n) => {
        n.selected = _.get(unfilteredNodesByID, [n.id, 'selected'], false);
      });
      setNodes(filterData);
    }
  }, [data, isFiltered, nodes, unfilteredNodes]);

  const onSelect = (
    event: React.MouseEvent<HTMLButtonElement>,
    isSelected: boolean,
    index: number,
  ) => {
    event.stopPropagation();
    let formattedNodes;
    if (index === -1) {
      formattedNodes = nodes.map((node) => {
        node.selected = isSelected;
        return node;
      });
    } else {
      formattedNodes = [...nodes];
      formattedNodes[index].selected = isSelected;
    }
    setNodes(formattedNodes);
    const nodesByID = _.keyBy(nodes, 'id');
    const setSelectedUnfilteredNodes = _.each(unfilteredNodes, (n) => {
      if (_.get(nodesByID, [n.id, 'id']) === n.metadata.name) {
        n.selected = _.get(nodesByID, [getName(n), 'selected'], false);
      }
    });
    setUnfilteredNodes(setSelectedUnfilteredNodes);
  };

  const makeLabelNodesRequest = (selectedNodes: NodeKind[]): Promise<NodeKind>[] => {
    return selectedNodes.map((node: NodeKind) => {
      const patch = [
        {
          op: 'add',
          path: '/metadata/labels/cluster.ocs.openshift.io~1openshift-storage',
          value: '',
        },
      ];
      return k8sPatch(NodeModel, node, patch);
    });
  };

  // tainting the selected nodes
  // const makeTaintNodesRequest = (selectedNode: NodeKind[]): Promise<NodeKind>[] => {
  //   const taintNodesRequest = selectedNode
  //     .filter((node: NodeKind) => {
  //       const roles = getNodeRoles(node);
  //       // don't taint master nodes as its already tainted
  //       return roles.indexOf('master') === -1;
  //     })
  //     .map((node) => {
  //       const taints = node.spec && node.spec.taints ? [...node.spec.taints, taintObj] : [taintObj];
  //       const patch = [
  //         {
  //           value: taints,
  //           path: '/spec/taints',
  //           op: node.spec.taints ? 'replace' : 'add',
  //         },
  //       ];
  //       return k8sPatch(NodeModel, node, patch);
  //     });

  //   return taintNodesRequest;
  // };

  const makeOCSRequest = () => {
    const selectedData: NodeKind[] = _.filter(nodes, 'selected');
    const promises = [];

    promises.push(...makeLabelNodesRequest(selectedData));
    // intentionally keeping the taint logic as its required in 4.3 and will be handled with checkbox selection
    // promises.push(...makeTaintNodesRequest(selectedData));

    const ocsObj = _.cloneDeep(ocsRequestData);
    ocsObj.spec.storageDeviceSets[0].dataPVCTemplate.spec.storageClassName = storageClass;
    promises.push(k8sCreate(OCSServiceModel, ocsObj));

    Promise.all(promises)
      .then(() => {
        history.push(
          `/k8s/ns/${ocsProps.namespace}/clusterserviceversions/${
            ocsProps.clusterServiceVersion.metadata.name
          }/${referenceForModel(OCSServiceModel)}/${ocsObj.metadata.name}`,
        );
      })
      .catch((err) => {
        setProgress(false);
        setError(err.message);
      });
  };

  const submit = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setProgress(true);
    setError('');

    let provisioner = '';

    k8sGet(InfrastructureModel, 'cluster')
      .then((infra: K8sResourceKind) => {
        // find infra supported provisioner
        provisioner = infraProvisionerMap[_.toLower(getInfrastructurePlatform(infra))];
        return k8sList(StorageClassModel);
      })
      .then((storageClasses: StorageClassResourceKind[]) => {
        // find all storageclass with the given provisioner
        const scList = _.filter(storageClasses, (sc) => sc.provisioner === provisioner);
        // take the default storageclass
        _.forEach(scList, (sc) => {
          if (isDefaultClass(sc)) {
            storageClass = sc.metadata.name;
          }
        });
        makeOCSRequest();
      })
      .catch((err) => {
        setProgress(false);
        setError(err.message);
      });
  };

  return (
    <>
      <div className="node-list__max-height">
        <Table
          aria-label="node list table"
          onSelect={onSelect}
          cells={columns}
          rows={nodes}
          variant={TableVariant.compact}
          gridBreakPoint={TableGridBreakpoint.none}
        >
          <TableHeader />
          <TableBody />
        </Table>
      </div>
      <p className="control-label help-block" id="nodes-selected">
        {selectedNodesCnt} node(s) selected
      </p>
      <ButtonBar errorMessage={error} inProgress={inProgress}>
        <ActionGroup className="pf-c-form">
          <Button
            type="button"
            variant="primary"
            onClick={submit}
            isDisabled={selectedNodesCnt < minSelectedNode}
          >
            Create
          </Button>
          <Button type="button" variant="secondary" onClick={history.goBack}>
            Cancel
          </Button>
        </ActionGroup>
      </ButtonBar>
    </>
  );
};

export const NodeList = connect<{}, CustomNodeTableProps>(stateToProps)(CustomNodeTable);

type CustomNodeTableProps = {
  data: NodeKind[];
  unfilteredData: UnfilteredDataType[];
  loaded: boolean;
  ocsProps: ocsPropsType;
  isFiltered: boolean;
};

type ocsPropsType = {
  namespace: string;
  clusterServiceVersion: K8sResourceKind;
};

type UnfilteredDataType = NodeKind & {
  selected: boolean;
};

type formattedNodeType = {
  cells: any[];
  selected: boolean;
  id: string;
  metadata: {};
  spec: {};
};
